import { prisma } from '../config/database.js';
import { OPEN_REGISTRATION_KEY } from '../constants/index.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { addMonths, startOfDay } from '../utils/date.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';
import { assertCapacity, assertEligible, assertNoTicketOverlap, lockArea, lockRegistration, lockVehicle, registrationPeriod, transactionOptions } from './business-rules.js';

const include = { resident: { include: { user: { select: { fullName: true, email: true } } } }, vehicle: true, plan: true, area: true, payments: true, ticket: true };
const assertAccess = (auth: any, residentId: number) => {
  if (auth.role === 'RESIDENT' && auth.residentId === residentId) return;
  if (['MANAGER', 'ADMIN'].includes(auth.role)) return;
  throw forbidden();
};
export const registrationService = {
  list(auth: any) { return prisma.parkingRegistration.findMany({ where: auth.role === 'RESIDENT' ? { residentId: auth.residentId } : {}, include, orderBy: { createdAt: 'desc' } }); },
  async get(auth: any, id: number) {
    const row = await prisma.parkingRegistration.findUnique({ where: { id }, include });
    if (!row) throw notFound('Đăng ký');
    assertAccess(auth, row.residentId);
    return row;
  },
  async create(auth: any, input: any) {
    if (!auth.residentId) throw forbidden();
    return prisma.$transaction(async tx => {
      await lockVehicle(tx, input.vehicleId);
      await lockArea(tx, input.areaId);
      await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingPlan` WHERE `id` = ? FOR UPDATE', input.planId);
      const now = new Date();
      const { vehicle, plan } = await assertEligible(tx, { ...input, residentId: auth.residentId });
      let requestedStartDate = input.requestedStartDate ?? now;
      if (input.previousTicketId) {
        const previous = await tx.parkingTicket.findUnique({ where: { id: input.previousTicketId } });
        if (!previous || previous.vehicleId !== vehicle.id || !['ACTIVE', 'EXPIRED'].includes(previous.status)) {
          throw new AppError(409, 'INVALID_RENEWAL_TICKET', 'Chỉ gia hạn vé đang hoạt động hoặc hết hạn của chính xe này');
        }
        // A renewal cannot be backdated or used to bypass a locked ticket.
        requestedStartDate = new Date(Math.max(now.getTime(), previous.endDate.getTime()));
      } else {
        if (requestedStartDate < startOfDay(now)) throw new AppError(422, 'INVALID_START_DATE', 'Ngày bắt đầu không được ở trong quá khứ');
        requestedStartDate = new Date(Math.max(now.getTime(), requestedStartDate.getTime()));
        const active = await tx.parkingTicket.findFirst({ where: { vehicleId: vehicle.id, status: { in: ['ACTIVE', 'LOCKED'] }, endDate: { gt: now } } });
        if (active) throw new AppError(409, 'ACTIVE_TICKET_EXISTS', 'Xe đang có vé còn hiệu lực; hãy sử dụng chức năng gia hạn');
      }
      const end = addMonths(requestedStartDate, plan.durationMonths);
      await assertNoTicketOverlap(tx, vehicle.id, requestedStartDate, end);
      await tx.parkingRegistration.updateMany({
        where: { vehicleId: vehicle.id, status: { in: ['PENDING', 'APPROVED'] }, expiresAt: { lte: now }, ticket: { is: null } },
        data: { status: 'CANCELLED', openRequestKey: null },
      });
      const open = await tx.parkingRegistration.findFirst({ where: { vehicleId: vehicle.id, status: { in: ['PENDING', 'APPROVED'] }, ticket: { is: null }, expiresAt: { gt: now } } });
      if (open) throw new AppError(409, 'OPEN_REGISTRATION_EXISTS', 'Xe đã có đăng ký chờ duyệt hoặc chờ thanh toán');
      const prices = await tx.priceConfig.findMany({
        where: { planId: plan.id, status: 'ACTIVE', effectiveFrom: { lte: requestedStartDate }, AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: requestedStartDate } }] }, { OR: [{ areaId: input.areaId }, { areaId: null }] }] },
        orderBy: { effectiveFrom: 'desc' },
      });
      const price = prices.find(x => x.areaId === input.areaId) ?? prices.find(x => x.areaId === null);
      const created = await tx.parkingRegistration.create({
        data: { residentId: auth.residentId, vehicleId: vehicle.id, planId: plan.id, areaId: input.areaId,
          quotedAmount: (price?.amount ?? plan.monthlyPrice).mul(plan.durationMonths), priceConfigId: price?.id,
          requestedStartDate, note: input.note, type: input.previousTicketId ? 'RENEWAL' : 'NEW', previousTicketId: input.previousTicketId,
          openRequestKey: OPEN_REGISTRATION_KEY(vehicle.id), expiresAt: new Date(now.getTime() + 30 * 86400000) },
        include,
      });
      await auditService.record(auth, { action: 'REGISTRATION_CREATE', entity: 'ParkingRegistration', entityId: created.id }, tx);
      return created;
    }, transactionOptions);
  },
  async approve(id: number, actor: any) {
    const outcome = await prisma.$transaction(async tx => {
      const row = await lockRegistration(tx, id), now = new Date();
      if (row.status !== 'PENDING') throw new AppError(409, 'INVALID_REGISTRATION_STATUS', 'Chỉ duyệt đăng ký PENDING');
      if (row.expiresAt <= now) {
        await tx.parkingRegistration.update({ where: { id }, data: { status: 'CANCELLED', openRequestKey: null } });
        await auditService.record(actor, { action: 'REGISTRATION_EXPIRED', entity: 'ParkingRegistration', entityId: id }, tx);
        return null;
      }
      const { area } = await assertEligible(tx, row);
      if (row.previousTicket && !['ACTIVE', 'EXPIRED'].includes(row.previousTicket.status)) throw new AppError(409, 'INVALID_RENEWAL_TICKET', 'Vé gốc không còn đủ điều kiện gia hạn');
      const { start, end } = registrationPeriod(row, now);
      await assertNoTicketOverlap(tx, row.vehicleId, start, end);
      await assertCapacity(tx, area, start, end, id);
      // Approval holds one place until payment, cancellation or expiry.
      await tx.parkingRegistration.update({ where: { id }, data: { status: 'APPROVED', reviewerId: actor.userId, reviewedAt: now, openRequestKey: OPEN_REGISTRATION_KEY(row.vehicleId) } });
      await auditService.record(actor, { action: 'REGISTRATION_APPROVE', entity: 'ParkingRegistration', entityId: id }, tx);
      return tx.parkingRegistration.findUniqueOrThrow({ where: { id }, include });
    }, transactionOptions);
    if (!outcome) throw new AppError(409, 'REGISTRATION_EXPIRED', 'Đăng ký đã hết hạn xử lý');
    await notificationService.send(outcome.resident.userId, outcome.residentId, 'REGISTRATION_APPROVED', 'Đăng ký được duyệt', `Đăng ký #${id} đã được duyệt.`, `registration-approved:${id}`);
    return outcome;
  },
  async reject(id: number, actor: any, reason: string) {
    const result = await prisma.$transaction(async tx => {
      const row = await lockRegistration(tx, id);
      if (row.status !== 'PENDING') throw new AppError(409, 'INVALID_REGISTRATION_STATUS', 'Chỉ từ chối đăng ký PENDING');
      if (row.expiresAt <= new Date()) throw new AppError(409, 'REGISTRATION_EXPIRED', 'Đăng ký đã hết hạn xử lý');
      await tx.parkingRegistration.update({ where: { id }, data: { status: 'REJECTED', reviewerId: actor.userId, reviewedAt: new Date(), rejectionReason: reason, openRequestKey: null } });
      await auditService.record(actor, { action: 'REGISTRATION_REJECT', entity: 'ParkingRegistration', entityId: id, reason }, tx);
      return tx.parkingRegistration.findUniqueOrThrow({ where: { id }, include });
    }, transactionOptions);
    await notificationService.send(result.resident.userId, result.residentId, 'REGISTRATION_REJECTED', 'Đăng ký bị từ chối', reason, `registration-rejected:${id}`);
    return result;
  },
  async cancel(auth: any, id: number) {
    return prisma.$transaction(async tx => {
      const row = await lockRegistration(tx, id);
      assertAccess(auth, row.residentId);
      if (!['PENDING', 'APPROVED'].includes(row.status)) throw new AppError(409, 'INVALID_REGISTRATION_STATUS', 'Không thể hủy đăng ký này');
      if (await tx.parkingTicket.findUnique({ where: { registrationId: id } }) || await tx.payment.findFirst({ where: { registrationId: id, status: 'PAID' } })) throw new AppError(409, 'REGISTRATION_ALREADY_PAID', 'Đăng ký đã phát hành vé; cần xử lý vé hoặc hoàn tiền');
      const result = await tx.parkingRegistration.update({ where: { id }, data: { status: 'CANCELLED', openRequestKey: null } });
      await tx.payment.updateMany({ where: { registrationId: id, status: 'PENDING' }, data: { status: 'FAILED' } });
      await auditService.record(auth, { action: 'REGISTRATION_CANCEL', entity: 'ParkingRegistration', entityId: id }, tx);
      return result;
    }, transactionOptions);
  },
};
