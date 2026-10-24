import { prisma } from '../config/database.js';
import { OPEN_SESSION_KEY } from '../constants/index.js';
import { AppError, notFound } from '../utils/app-error.js';
import { normalizePlate } from '../utils/security.js';
import { auditService } from './audit.service.js';
import { openSessionWhere, occupiedVehicles, lockArea, lockVehicle, syncVehicleTickets, transactionOptions } from './business-rules.js';

const sessionInclude = { vehicle: true, ticket: { select: { id: true, ticketCode: true, status: true, startDate: true, endDate: true } }, area: true, checkInGuard: { select: { fullName: true } }, checkOutGuard: { select: { fullName: true } } };
type ParkingInput = { qrToken: string; gate: string; requestId?: string; vehicleId?: number; areaId?: number; licensePlate?: string };
async function lockQrVehicle(tx: any, qrToken: string) {
  const ticket = await tx.parkingTicket.findUnique({ where: { qrToken } });
  if (!ticket) throw new AppError(404, 'INVALID_QR', 'QR không tồn tại hoặc đã bị vô hiệu');
  await lockVehicle(tx, ticket.vehicleId);
  await syncVehicleTickets(tx, ticket.vehicleId);
  return ticket;
}
async function verifyTicket(client: any, qrToken: string, observedVehicleId?: number, observedAreaId?: number, mode: 'IN' | 'OUT' = 'IN', licensePlate?: string) {
  const ticket = await client.parkingTicket.findUnique({ where: { qrToken }, include: { vehicle: { include: { resident: { select: { status: true, user: { select: { status: true } } } } } }, area: true } });
  if (!ticket) throw new AppError(404, 'INVALID_QR', 'QR không tồn tại hoặc đã bị vô hiệu');
  const now = new Date();
  if (ticket.status === 'LOCKED') throw new AppError(409, 'TICKET_LOCKED', 'Vé đang bị khóa; liên hệ quản lý để xác minh và xử lý lượt ra');
  if (['REVOKED', 'CANCELLED'].includes(ticket.status)) throw new AppError(409, 'QR_REVOKED', 'QR đã bị thu hồi');
  if (observedVehicleId && observedVehicleId !== ticket.vehicleId) throw new AppError(409, 'VEHICLE_MISMATCH', 'QR không thuộc phương tiện đang kiểm tra');
  if (licensePlate && normalizePlate(licensePlate) !== normalizePlate(ticket.vehicle.licensePlate)) throw new AppError(409, 'VEHICLE_MISMATCH', 'Biển số quan sát không khớp với vé');
  if (observedAreaId && observedAreaId !== ticket.areaId) throw new AppError(409, 'PARKING_AREA_MISMATCH', 'Vé không có hiệu lực tại bãi xe này');
  if (mode === 'IN') {
    if (ticket.startDate > now || ticket.endDate <= now || ticket.status === 'EXPIRED') throw new AppError(409, 'TICKET_EXPIRED', 'Vé chưa đến hạn hoặc đã hết hạn');
    if (ticket.status !== 'ACTIVE') throw new AppError(409, 'TICKET_NOT_ACTIVE', 'Vé không hoạt động');
    if (ticket.vehicle.status !== 'ACTIVE') throw new AppError(409, 'VEHICLE_INACTIVE', 'Xe không hoạt động');
    if (ticket.vehicle.resident.status !== 'ACTIVE' || ticket.vehicle.resident.user.status !== 'ACTIVE') throw new AppError(409, 'RESIDENT_INACTIVE', 'Cư dân không còn hoạt động');
    if (ticket.area.status !== 'ACTIVE') throw new AppError(409, 'PARKING_UNAVAILABLE', 'Bãi xe đã ngừng nhận xe');
  } else {
    // Expiry alone cannot trap a resident's vehicle inside the building.
    if (!['ACTIVE', 'EXPIRED'].includes(ticket.status) || ticket.startDate > now) throw new AppError(409, 'TICKET_NOT_ACTIVE', 'Vé không hợp lệ để xác minh lượt ra');
    const session = await client.parkingSession.findFirst({ where: { vehicleId: ticket.vehicleId, ...openSessionWhere } });
    if (!session) throw new AppError(409, 'NOT_PARKING', 'Không tìm thấy lượt xe đang trong bãi');
    if (session.status === 'ABNORMAL') throw new AppError(409, 'MANUAL_VERIFICATION_REQUIRED', 'Lượt cũ thiếu giờ ra; quản lý cần đối chiếu và xác minh trên trang Lượt ra vào');
    if (session.areaId !== ticket.areaId) throw new AppError(409, 'PARKING_AREA_MISMATCH', 'Lượt vào thuộc bãi khác; cần quản lý xác minh');
  }
  return ticket;
}
async function replay(tx: any, direction: 'IN' | 'OUT', input: ParkingInput, actor: any) {
  if (!input.requestId) return null;
  const previous = await tx.parkingSession.findUnique({ where: direction === 'IN' ? { checkInRequestKey: input.requestId } : { checkOutRequestKey: input.requestId }, include: sessionInclude });
  if (!previous) return null;
  const qr = await tx.parkingTicket.findUnique({ where: { qrToken: input.qrToken } });
  const gate = direction === 'IN' ? previous.checkInGate : previous.checkOutGate;
  const actorId = direction === 'IN' ? previous.checkInGuardId : previous.checkOutGuardId;
  if (!qr || qr.vehicleId !== previous.vehicleId || qr.areaId !== previous.areaId || gate !== input.gate || actorId !== actor.userId ||
      (input.vehicleId && input.vehicleId !== previous.vehicleId) || (input.areaId && input.areaId !== previous.areaId) ||
      (input.licensePlate && normalizePlate(input.licensePlate) !== normalizePlate(previous.vehicle.licensePlate))) {
    throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Mã yêu cầu đã được dùng cho lượt xe khác');
  }
  return previous;
}
export const parkingService = {
  async lookupVehicle(licensePlate: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { normalizedPlate: normalizePlate(licensePlate) }, select: { id: true, licensePlate: true, type: true, brand: true, color: true, status: true } });
    if (!vehicle) throw new AppError(404, 'VEHICLE_NOT_REGISTERED', 'Chưa có xe này trong hệ thống. Báo quản lý để xác minh phương tiện trước khi lập biên bản.');
    return vehicle;
  },
  async verify(qrToken: string, vehicleId?: number, areaId?: number, mode: 'IN' | 'OUT' = 'IN', licensePlate?: string) {
    return prisma.$transaction(async tx => {
      await lockQrVehicle(tx, qrToken);
      const ticket = await verifyTicket(tx, qrToken, vehicleId, areaId, mode, licensePlate);
      const { qrToken: _token, ...safe } = ticket;
      void _token;
      return safe;
    }, transactionOptions);
  },
  async checkIn(input: ParkingInput, actor: any) {
    return prisma.$transaction(async tx => {
      const initial = await lockQrVehicle(tx, input.qrToken);
      await lockArea(tx, initial.areaId);
      const previous = await replay(tx, 'IN', input, actor);
      if (previous) return previous;
      const ticket = await verifyTicket(tx, input.qrToken, input.vehicleId, input.areaId, 'IN', input.licensePlate);
      if (await tx.parkingSession.findFirst({ where: { vehicleId: ticket.vehicleId, ...openSessionWhere } })) throw new AppError(409, 'ALREADY_PARKING', 'Xe đã ở trong bãi');
      const occupied = await occupiedVehicles(tx, ticket.areaId);
      if (ticket.area.capacity <= 0 || occupied >= ticket.area.capacity) throw new AppError(409, 'PARKING_FULL', 'Bãi xe đã đầy');
      const session = await tx.parkingSession.create({ data: { vehicleId: ticket.vehicleId, ticketId: ticket.id, areaId: ticket.areaId, checkInGuardId: actor.userId, checkInGate: input.gate, openVehicleKey: OPEN_SESSION_KEY(ticket.vehicleId), checkInRequestKey: input.requestId }, include: sessionInclude });
      await auditService.record(actor, { action: 'PARKING_CHECK_IN', entity: 'ParkingSession', entityId: session.id, metadata: { gate: input.gate } }, tx);
      return session;
    }, transactionOptions);
  },
  async checkOut(input: ParkingInput, actor: any) {
    return prisma.$transaction(async tx => {
      const initial = await lockQrVehicle(tx, input.qrToken);
      await lockArea(tx, initial.areaId);
      const previous = await replay(tx, 'OUT', input, actor);
      if (previous) return previous;
      const ticket = await verifyTicket(tx, input.qrToken, input.vehicleId, input.areaId, 'OUT', input.licensePlate);
      const session = await tx.parkingSession.findFirstOrThrow({ where: { vehicleId: ticket.vehicleId, ...openSessionWhere } });
      const expired = ticket.endDate <= new Date();
      const result = await tx.parkingSession.update({ where: { id: session.id }, data: { checkOutAt: new Date(), checkOutGuardId: actor.userId, checkOutGate: input.gate, checkOutRequestKey: input.requestId, status: 'COMPLETED', openVehicleKey: null, ...(expired ? { abnormalReason: 'Vé hết hạn trong thời gian xe đang gửi; đã đối chiếu QR khi ra' } : {}) }, include: sessionInclude });
      await auditService.record(actor, { action: 'PARKING_CHECK_OUT', entity: 'ParkingSession', entityId: session.id, metadata: { gate: input.gate, expiredTicket: expired } }, tx);
      return result;
    }, transactionOptions);
  },
  list(auth: any) { return prisma.parkingSession.findMany({ where: auth.role === 'RESIDENT' ? { vehicle: { residentId: auth.residentId } } : {}, include: sessionInclude, orderBy: { checkInAt: 'desc' } }); },
  async get(id: number) {
    const row = await prisma.parkingSession.findUnique({ where: { id }, include: sessionInclude });
    if (!row) throw notFound('Lượt ra vào');
    return row;
  },
  async manualCheckout(id: number, actor: any, gate: string, reason: string) {
    return prisma.$transaction(async tx => {
      const before = await tx.parkingSession.findUnique({ where: { id } });
      if (!before) throw notFound('Lượt ra vào');
      await lockVehicle(tx, before.vehicleId);
      const session = await tx.parkingSession.findUniqueOrThrow({ where: { id } });
      if (session.status !== 'PARKING' && !(session.status === 'ABNORMAL' && session.checkOutAt === null)) throw new AppError(409, 'SESSION_ALREADY_CLOSED', 'Lượt xe đã kết thúc');
      const updated = await tx.parkingSession.update({ where: { id }, data: { checkOutAt: new Date(), checkOutGuardId: actor.userId, checkOutGate: gate, status: 'ABNORMAL', abnormalReason: reason, openVehicleKey: null } });
      await auditService.record(actor, { action: 'PARKING_MANUAL_CHECKOUT', entity: 'ParkingSession', entityId: id, reason, metadata: { gate } }, tx);
      return updated;
    }, transactionOptions);
  },
  async correct(id: number, actor: any, input: any) {
    return prisma.$transaction(async tx => {
      const before = await tx.parkingSession.findUnique({ where: { id } });
      if (!before) throw notFound('Lượt ra vào');
      await lockVehicle(tx, before.vehicleId);
      const session = await tx.parkingSession.findUniqueOrThrow({ where: { id } });
      const { reason, ...changes } = input;
      const next = { ...session, ...changes }, now = new Date();
      if ((session.status === 'PARKING') !== (next.status === 'PARKING')) throw new AppError(409, 'SESSION_TRANSITION_FORBIDDEN', 'Không dùng hiệu chỉnh để mở lại hoặc đóng lượt xe; dùng chức năng xác minh ra bãi');
      if (next.checkInAt > now || (next.checkOutAt && (next.checkOutAt < next.checkInAt || next.checkOutAt > now))) throw new AppError(422, 'INVALID_SESSION_TIME', 'Giờ ra phải sau giờ vào và không nằm trong tương lai');
      if (next.status === 'PARKING' && (next.checkOutAt || next.checkOutGate)) throw new AppError(422, 'INVALID_SESSION_STATE', 'Xe đang gửi không được có thông tin đã ra bãi');
      if (next.status !== 'PARKING' && (!next.checkOutAt || !next.checkOutGate)) throw new AppError(422, 'INVALID_SESSION_STATE', 'Lượt đã kết thúc phải có giờ ra và cổng ra');
      if (next.status === 'ABNORMAL' && !next.abnormalReason?.trim()) throw new AppError(422, 'ABNORMAL_REASON_REQUIRED', 'Lượt bất thường phải có lý do');
      const updated = await tx.parkingSession.update({ where: { id }, data: changes });
      await auditService.record(actor, { action: 'PARKING_CORRECTION', entity: 'ParkingSession', entityId: id, reason, metadata: { before: { checkInAt: session.checkInAt.toISOString(), checkOutAt: session.checkOutAt?.toISOString() }, changes } }, tx);
      return updated;
    }, transactionOptions);
  },
};
