import { AppError, notFound } from '../utils/app-error.js';
import { addMonths } from '../utils/date.js';

export const transactionOptions = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 20000 };
// Legacy cron marked some sessions ABNORMAL without recording an exit. Keep them
// unresolved until a manager verifies the exit; elapsed time is not evidence.
export const openSessionWhere = { OR: [{ status: 'PARKING' as const }, { status: 'ABNORMAL' as const, checkOutAt: null }] };
export async function occupiedVehicles(tx: any, areaId: number) {
  const rows = await tx.parkingSession.findMany({ where: { areaId, ...openSessionWhere }, select: { vehicleId: true }, distinct: ['vehicleId'] });
  return rows.length;
}

// All admission/payment/parking writers lock the vehicle first, then the area.
export async function lockVehicle(tx: any, id: number) {
  await tx.$queryRawUnsafe('SELECT `id` FROM `Vehicle` WHERE `id` = ? FOR UPDATE', id);
}
export async function lockArea(tx: any, id: number) {
  await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingArea` WHERE `id` = ? FOR UPDATE', id);
}
export async function lockRegistration(tx: any, id: number) {
  const row = await tx.parkingRegistration.findUnique({ where: { id } });
  if (!row) throw notFound('Đăng ký');
  await lockVehicle(tx, row.vehicleId);
  await lockArea(tx, row.areaId);
  await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingRegistration` WHERE `id` = ? FOR UPDATE', id);
  return tx.parkingRegistration.findUniqueOrThrow({ where: { id }, include: { plan: true, previousTicket: true } });
}
export function registrationPeriod(reg: any, now = new Date()) {
  const start = new Date(Math.max(now.getTime(), reg.requestedStartDate.getTime(), reg.previousTicket?.endDate.getTime() ?? 0));
  return { start, end: addMonths(start, reg.plan.durationMonths) };
}
export async function assertEligible(tx: any, reg: any) {
  const [vehicle, plan, area] = await Promise.all([
    tx.vehicle.findUnique({ where: { id: reg.vehicleId }, include: { resident: { include: { user: true } } } }),
    tx.parkingPlan.findUnique({ where: { id: reg.planId } }),
    tx.parkingArea.findUnique({ where: { id: reg.areaId } }),
  ]);
  if (!vehicle || vehicle.residentId !== reg.residentId || vehicle.status !== 'ACTIVE') throw new AppError(409, 'VEHICLE_INACTIVE', 'Phương tiện không còn hợp lệ');
  if (vehicle.resident.status !== 'ACTIVE' || vehicle.resident.user.status !== 'ACTIVE') throw new AppError(409, 'RESIDENT_INACTIVE', 'Cư dân hoặc tài khoản đã ngừng hoạt động');
  if (!plan || plan.status !== 'ACTIVE') throw new AppError(409, 'PLAN_INACTIVE', 'Gói gửi xe đã ngừng áp dụng');
  if (plan.vehicleType !== vehicle.type) throw new AppError(409, 'VEHICLE_TYPE_MISMATCH', 'Loại xe không phù hợp gói');
  if (!area || area.status !== 'ACTIVE' || area.capacity <= 0) throw new AppError(409, 'PARKING_UNAVAILABLE', 'Bãi xe không nhận đăng ký hoặc lượt vào mới');
  return { vehicle, plan, area };
}
export async function assertNoTicketOverlap(tx: any, vehicleId: number, start: Date, end: Date, excludeId?: number) {
  const overlap = await tx.parkingTicket.findFirst({ where: {
    vehicleId, id: excludeId ? { not: excludeId } : undefined,
    status: { in: ['PENDING', 'ACTIVE', 'LOCKED'] }, startDate: { lt: end }, endDate: { gt: start },
  } });
  if (overlap) throw new AppError(409, 'TICKET_PERIOD_OVERLAP', 'Xe đã có vé trong khoảng thời gian này');
}
export async function reservationIntervals(tx: any, areaId: number, now: Date, excludeRegistrationId?: number) {
  const [tickets, holds] = await Promise.all([
    tx.parkingTicket.findMany({ where: { areaId, status: { in: ['PENDING', 'ACTIVE', 'LOCKED'] }, endDate: { gt: now } } }),
    tx.parkingRegistration.findMany({ where: {
      areaId, id: excludeRegistrationId ? { not: excludeRegistrationId } : undefined,
      status: 'APPROVED', expiresAt: { gt: now }, ticket: { is: null },
    }, include: { plan: true, previousTicket: true } }),
  ]);
  return [
    ...tickets.map((t: any) => ({ start: t.startDate, end: t.endDate })),
    ...holds.map((r: any) => registrationPeriod(r, now)),
  ];
}
export function peakOccupancy(intervals: { start: Date; end: Date }[], start: Date, end: Date) {
  const events: { time: number; delta: number }[] = [];
  for (const interval of intervals) {
    const from = Math.max(interval.start.getTime(), start.getTime());
    const to = Math.min(interval.end.getTime(), end.getTime());
    if (from < to) events.push({ time: from, delta: 1 }, { time: to, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let current = 0, peak = 0;
  for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
  return peak;
}
export async function assertCapacity(tx: any, area: any, start: Date, end: Date, excludeRegistrationId?: number) {
  const intervals = await reservationIntervals(tx, area.id, new Date(), excludeRegistrationId);
  if (peakOccupancy(intervals, start, end) >= area.capacity) throw new AppError(409, 'PARKING_FULL', 'Bãi xe đã hết chỗ trong thời hạn đăng ký');
}
// Expire all old tickets before activating renewals; never free a physical parking session.
export async function syncVehicleTickets(tx: any, vehicleId: number, now = new Date()) {
  const expired = await tx.parkingTicket.findMany({ where: { vehicleId, status: { in: ['ACTIVE', 'PENDING', 'LOCKED'] }, endDate: { lte: now } }, select: { id: true } });
  await tx.parkingTicket.updateMany({ where: { vehicleId, status: { in: ['ACTIVE', 'PENDING', 'LOCKED'] }, endDate: { lte: now } }, data: { status: 'EXPIRED', activeVehicleKey: null } });
  for (const ticket of expired) await tx.auditLog.create({ data: { actorRole: 'ADMIN', action: 'TICKET_EXPIRE', entity: 'ParkingTicket', entityId: String(ticket.id), reason: 'Vé hết thời hạn sử dụng' } });
  const pending = await tx.parkingTicket.findMany({ where: { vehicleId, status: 'PENDING', startDate: { lte: now }, endDate: { gt: now } }, orderBy: { startDate: 'asc' } });
  for (const ticket of pending) {
    const conflict = await tx.parkingTicket.findFirst({ where: { vehicleId, status: { in: ['ACTIVE', 'LOCKED'] }, endDate: { gt: now } } });
    if (conflict) continue;
    await tx.parkingTicket.update({ where: { id: ticket.id }, data: { status: 'ACTIVE', activeVehicleKey: `ACTIVE:${vehicleId}` } });
    await tx.auditLog.create({ data: { actorRole: 'ADMIN', action: 'TICKET_ACTIVATE', entity: 'ParkingTicket', entityId: String(ticket.id), reason: 'Vé đến thời điểm bắt đầu' } });
  }
}

export async function cancelUnpaidRenewals(tx: any, ticketId: number) {
  const rows = await tx.parkingRegistration.findMany({ where: { previousTicketId: ticketId, status: { in: ['PENDING', 'APPROVED'] }, ticket: { is: null } }, select: { id: true } });
  const ids = rows.map((r: any) => r.id);
  if (!ids.length) return;
  await tx.parkingRegistration.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED', openRequestKey: null } });
  await tx.payment.updateMany({ where: { registrationId: { in: ids }, status: 'PENDING' }, data: { status: 'FAILED' } });
  for (const id of ids) await tx.auditLog.create({ data: { actorRole: 'ADMIN', action: 'RENEWAL_CANCELLED_WITH_PREVIOUS_TICKET', entity: 'ParkingRegistration', entityId: String(id), reason: 'Vé gốc bị hủy hoặc hoàn tiền', metadata: { previousTicketId: ticketId } } });
}
