import QRCode from 'qrcode';
import { prisma } from '../config/database.js';
import { ACTIVE_TICKET_KEY } from '../constants/index.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { code, randomToken } from '../utils/security.js';
import { notificationService } from './notification.service.js';
import { registrationService } from './registration.service.js';
import { auditService } from './audit.service.js';
import { openSessionWhere, cancelUnpaidRenewals, assertCapacity, assertEligible, assertNoTicketOverlap, lockVehicle, registrationPeriod, syncVehicleTickets, transactionOptions } from './business-rules.js';

const include = { vehicle: { include: { resident: { include: { user: { select: { fullName: true } } } } } }, plan: true, area: true, registration: true };
const assertOwner = (auth: any, row: any) => {
  if (auth.role === 'RESIDENT' && row.vehicle.residentId === auth.residentId) return;
  if (['MANAGER', 'ADMIN'].includes(auth.role)) return;
  throw forbidden();
};
async function lockedTicket(tx: any, id: number) {
  const row = await tx.parkingTicket.findUnique({ where: { id } });
  if (!row) throw notFound('Vé');
  await lockVehicle(tx, row.vehicleId);
  await syncVehicleTickets(tx, row.vehicleId);
  return tx.parkingTicket.findUniqueOrThrow({ where: { id }, include });
}
export const ticketService = {
  async list(auth: any) {
    const rows = await prisma.parkingTicket.findMany({ where: auth.role === 'RESIDENT' ? { vehicle: { residentId: auth.residentId } } : {}, select: { vehicleId: true }, distinct: ['vehicleId'] });
    for (const row of rows) await prisma.$transaction(async tx => { await lockVehicle(tx, row.vehicleId); await syncVehicleTickets(tx, row.vehicleId); }, transactionOptions);
    return prisma.parkingTicket.findMany({ where: auth.role === 'RESIDENT' ? { vehicle: { residentId: auth.residentId } } : {}, include, orderBy: { createdAt: 'desc' } });
  },
  async get(auth: any, id: number) {
    const before = await prisma.parkingTicket.findUnique({ where: { id }, include });
    if (!before) throw notFound('Vé');
    assertOwner(auth, before);
    return prisma.$transaction(tx => lockedTicket(tx, id), transactionOptions);
  },
  async createFromPayment(tx: any, registration: any, paymentId: number) {
    // Caller already holds vehicle, area and registration locks.
    if (await tx.parkingTicket.findUnique({ where: { registrationId: registration.id } })) throw new AppError(409, 'TICKET_ALREADY_ISSUED', 'Đăng ký đã phát hành vé, không được thu tiền lần nữa');
    const now = new Date();
    if (registration.expiresAt <= now) throw new AppError(409, 'REGISTRATION_EXPIRED', 'Đăng ký đã hết hạn thanh toán');
    const { area } = await assertEligible(tx, registration);
    if (registration.previousTicket && !['ACTIVE', 'EXPIRED'].includes(registration.previousTicket.status)) throw new AppError(409, 'INVALID_RENEWAL_TICKET', 'Vé gốc không còn đủ điều kiện gia hạn');
    await syncVehicleTickets(tx, registration.vehicleId, now);
    const { start, end } = registrationPeriod(registration, now);
    await assertNoTicketOverlap(tx, registration.vehicleId, start, end);
    await assertCapacity(tx, area, start, end, registration.id);
    const active = start <= now;
    const ticket = await tx.parkingTicket.create({ data: {
      registrationId: registration.id, vehicleId: registration.vehicleId, planId: registration.planId, areaId: registration.areaId,
      priceConfigId: registration.priceConfigId, ticketCode: code('VE'), qrToken: randomToken(), startDate: start, endDate: end,
      price: registration.quotedAmount, status: active ? 'ACTIVE' : 'PENDING', activeVehicleKey: active ? ACTIVE_TICKET_KEY(registration.vehicleId) : null,
    } });
    await tx.payment.update({ where: { id: paymentId }, data: { ticketId: ticket.id } });
    await tx.parkingRegistration.update({ where: { id: registration.id }, data: { openRequestKey: null } });
    return ticket;
  },
  async qr(auth: any, id: number) {
    const row = await this.get(auth, id), now = new Date();
    if (row.status !== 'ACTIVE' || row.startDate > now || row.endDate <= now) throw new AppError(409, 'QR_UNAVAILABLE', 'Chỉ vé đang trong thời hạn sử dụng mới có thể hiển thị QR');
    return { token: row.qrToken, dataUrl: await QRCode.toDataURL(row.qrToken, { errorCorrectionLevel: 'H', margin: 2, width: 360 }) };
  },
  async renew(auth: any, id: number, input: any) {
    const row = await this.get(auth, id);
    if (!['ACTIVE', 'EXPIRED'].includes(row.status)) throw new AppError(409, 'CANNOT_RENEW', 'Cần xử lý khóa vé trước khi gia hạn');
    return registrationService.create(auth, { vehicleId: row.vehicleId, planId: input.planId ?? row.planId, areaId: input.areaId ?? row.areaId, previousTicketId: row.id });
  },
  async setStatus(auth: any, id: number, status: 'LOCKED' | 'ACTIVE' | 'CANCELLED', reason?: string) {
    const result = await prisma.$transaction(async tx => {
      const row = await lockedTicket(tx, id), now = new Date();
      if (status === 'LOCKED' && !['ACTIVE', 'LOCKED'].includes(row.status)) throw new AppError(409, 'INVALID_TICKET_TRANSITION', 'Chỉ có thể khóa vé còn hiệu lực');
      if (status === 'ACTIVE' && (row.status !== 'LOCKED' || row.startDate > now || row.endDate <= now)) throw new AppError(409, 'INVALID_TICKET_TRANSITION', 'Chỉ có thể mở vé LOCKED còn hiệu lực');
      if (status === 'ACTIVE' && row.lostReportedAt) throw new AppError(409, 'QR_REISSUE_REQUIRED', 'Vé báo mất phải được cấp QR mới');
      if (status === 'CANCELLED' && !['PENDING', 'ACTIVE', 'LOCKED'].includes(row.status)) throw new AppError(409, 'INVALID_TICKET_TRANSITION', 'Không thể hủy vé ở trạng thái hiện tại');
      if (status === 'CANCELLED' && await tx.parkingSession.findFirst({ where: { vehicleId: row.vehicleId, ...openSessionWhere } })) throw new AppError(409, 'VEHICLE_STILL_PARKING', 'Không thể hủy vé khi xe còn trong bãi');
      const updated = await tx.parkingTicket.update({ where: { id }, data: {
        status, lockReason: status === 'LOCKED' ? reason : null,
        // A locked entitlement still reserves this vehicle until expiry.
        activeVehicleKey: status === 'CANCELLED' ? null : ACTIVE_TICKET_KEY(row.vehicleId),
        ...(status === 'LOCKED' ? { lostReportedAt: null } : {}),
      } });
      if (status === 'CANCELLED') await cancelUnpaidRenewals(tx, id);
      await auditService.record(auth, { action: `TICKET_${status}`, entity: 'ParkingTicket', entityId: id, reason }, tx);
      return { row, updated };
    }, transactionOptions);
    if (status === 'LOCKED') await notificationService.send(result.row.vehicle.resident.userId, result.row.vehicle.residentId, 'TICKET_LOCKED', 'Vé bị khóa', reason ?? 'Vé đã bị khóa');
    return result.updated;
  },
  async reportLost(auth: any, id: number) {
    return prisma.$transaction(async tx => {
      const row = await lockedTicket(tx, id);
      assertOwner(auth, row);
      if (row.status !== 'ACTIVE') throw new AppError(409, 'INVALID_TICKET_TRANSITION', 'Chỉ vé ACTIVE mới có thể báo mất QR');
      const updated = await tx.parkingTicket.update({ where: { id }, data: { qrToken: randomToken(), qrVersion: { increment: 1 }, status: 'LOCKED', activeVehicleKey: ACTIVE_TICKET_KEY(row.vehicleId), lostReportedAt: new Date(), lockReason: 'Chủ xe báo mất QR' } });
      await auditService.record(auth, { action: 'QR_LOST', entity: 'ParkingTicket', entityId: id, reason: 'Chủ xe báo mất QR' }, tx);
      await tx.notification.create({ data: { userId: row.vehicle.resident.userId, residentId: row.vehicle.residentId, type: 'QR_LOST', title: 'Đã vô hiệu QR cũ', message: `QR của vé ${row.ticketCode} đã bị vô hiệu.`, dedupKey: `qr-lost:${id}:${updated.qrVersion}` } });
      return updated;
    }, transactionOptions);
  },
  async regenerate(auth: any, id: number) {
    return prisma.$transaction(async tx => {
      const row = await lockedTicket(tx, id), now = new Date();
      assertOwner(auth, row);
      if (row.status !== 'LOCKED' || !row.lostReportedAt) throw new AppError(409, 'NOT_REPORTED_LOST', 'Vé chưa được báo mất QR hoặc đang bị quản lý khóa');
      if (row.startDate > now || row.endDate <= now) throw new AppError(409, 'TICKET_EXPIRED', 'Vé chưa đến hạn hoặc đã hết hạn');
      const updated = await tx.parkingTicket.update({ where: { id }, data: { qrToken: randomToken(), qrVersion: { increment: 1 }, status: 'ACTIVE', activeVehicleKey: ACTIVE_TICKET_KEY(row.vehicleId), lockReason: null, lostReportedAt: null } });
      await auditService.record(auth, { action: 'QR_REGENERATE', entity: 'ParkingTicket', entityId: id }, tx);
      return updated;
    }, transactionOptions);
  },
};
