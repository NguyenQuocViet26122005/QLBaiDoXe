import { prisma } from '../config/database.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { code } from '../utils/security.js';
import { ticketService } from './ticket.service.js';
import { auditService } from './audit.service.js';
import { openSessionWhere, cancelUnpaidRenewals, assertEligible, lockRegistration, transactionOptions } from './business-rules.js';

const include = { registration: { include: { vehicle: true, resident: true, plan: true, previousTicket: true } }, ticket: true, confirmedBy: { select: { fullName: true } } };
const assertAccess = (auth: any, residentId: number) => {
  if (auth.role === 'RESIDENT' && auth.residentId === residentId) return;
  if (['MANAGER', 'ADMIN'].includes(auth.role)) return;
  throw forbidden();
};
async function assertPayable(tx: any, reg: any) {
  if (reg.status !== 'APPROVED') throw new AppError(409, 'REGISTRATION_NOT_APPROVED', 'Đăng ký chưa được duyệt hoặc đã bị hủy');
  if (reg.expiresAt <= new Date()) throw new AppError(409, 'REGISTRATION_EXPIRED', 'Đăng ký đã hết hạn thanh toán');
  if (await tx.payment.findFirst({ where: { registrationId: reg.id, status: 'PAID' } })) throw new AppError(409, 'ALREADY_PAID', 'Đăng ký đã thanh toán');
  if (await tx.parkingTicket.findUnique({ where: { registrationId: reg.id } })) throw new AppError(409, 'TICKET_ALREADY_ISSUED', 'Đăng ký đã phát hành vé; không thu lại tiền cho vé đã hủy hoặc hoàn tiền');
  await assertEligible(tx, reg);
}
export const paymentService = {
  list(auth: any) { return prisma.payment.findMany({ where: auth.role === 'RESIDENT' ? { registration: { residentId: auth.residentId } } : {}, include, orderBy: { createdAt: 'desc' } }); },
  async get(auth: any, id: number) {
    const row = await prisma.payment.findUnique({ where: { id }, include });
    if (!row) throw notFound('Thanh toán');
    assertAccess(auth, row.registration.residentId);
    return row;
  },
  async create(auth: any, input: any) {
    return prisma.$transaction(async tx => {
      const reg = await lockRegistration(tx, input.registrationId);
      if (input.idempotencyKey) {
        const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { ticket: true } });
        if (existing) {
          if (existing.registrationId !== input.registrationId || existing.method !== input.method) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Mã chống lặp đã được dùng cho yêu cầu khác');
          return { payment: existing, ticket: existing.ticket };
        }
      }
      await assertPayable(tx, reg);
      const isPaid = input.status === 'PAID';
      const payment = await tx.payment.create({ data: {
        registrationId: reg.id, paymentCode: code('TT'), amount: reg.quotedAmount, method: input.method, status: input.status, reference: input.reference,
        idempotencyKey: input.idempotencyKey, paidRegistrationKey: isPaid ? `PAID:${reg.id}` : null,
        confirmedById: isPaid ? auth.userId : null, paidAt: isPaid ? new Date() : null,
      } });
      const ticket = isPaid ? await ticketService.createFromPayment(tx, reg, payment.id) : null;
      if (isPaid) await tx.payment.updateMany({ where: { registrationId: reg.id, id: { not: payment.id }, status: 'PENDING' }, data: { status: 'FAILED' } });
      await auditService.record(auth, { action: isPaid ? 'PAYMENT_CONFIRM' : 'PAYMENT_CREATE', entity: 'Payment', entityId: payment.id, metadata: { status: input.status, registrationId: reg.id } }, tx);
      return { payment: await tx.payment.findUniqueOrThrow({ where: { id: payment.id } }), ticket };
    }, transactionOptions);
  },
  async updateStatus(auth: any, id: number, status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED') {
    return prisma.$transaction(async tx => {
      const before = await tx.payment.findUnique({ where: { id } });
      if (!before) throw notFound('Thanh toán');
      const registration = await lockRegistration(tx, before.registrationId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id }, include: { ticket: true } });
      if (payment.status === status) return { payment, ticket: payment.ticket };
      const allowed: Record<string, string[]> = { PENDING: ['PAID', 'FAILED'], FAILED: ['PENDING', 'PAID'], PAID: ['REFUNDED'], REFUNDED: [] };
      if (!(allowed[payment.status] ?? []).includes(status)) throw new AppError(409, 'INVALID_PAYMENT_TRANSITION', 'Không thể chuyển trạng thái thanh toán');
      let ticket = payment.ticket;
      if (status === 'PAID' || status === 'PENDING') await assertPayable(tx, registration);
      if (status === 'PAID') {
        await tx.payment.update({ where: { id }, data: { status, paidRegistrationKey: `PAID:${payment.registrationId}`, confirmedById: auth.userId, paidAt: new Date() } });
        ticket = await ticketService.createFromPayment(tx, registration, id);
        await tx.payment.updateMany({ where: { registrationId: registration.id, id: { not: id }, status: 'PENDING' }, data: { status: 'FAILED' } });
      } else if (status === 'REFUNDED') {
        if (ticket && await tx.parkingSession.findFirst({ where: { vehicleId: ticket.vehicleId, ...openSessionWhere } })) throw new AppError(409, 'VEHICLE_STILL_PARKING', 'Không thể hoàn tiền khi xe còn trong bãi');
        await tx.payment.update({ where: { id }, data: { status, paidRegistrationKey: null } });
        if (ticket) await cancelUnpaidRenewals(tx, ticket.id);
        if (ticket) ticket = await tx.parkingTicket.update({ where: { id: ticket.id }, data: { status: 'REVOKED', activeVehicleKey: null } });
        await tx.parkingRegistration.update({ where: { id: registration.id }, data: { status: 'CANCELLED', openRequestKey: null } });
      } else await tx.payment.update({ where: { id }, data: { status } });
      await auditService.record(auth, { action: `PAYMENT_${status}`, entity: 'Payment', entityId: id }, tx);
      return { payment: await tx.payment.findUniqueOrThrow({ where: { id } }), ticket };
    }, transactionOptions);
  },
};
