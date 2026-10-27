import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { addMonths, startOfDay } from '../src/utils/date.js';
import { processTicketExpiry } from '../src/jobs/expiry.job.js';

let resident = '', manager = '', guard = '', admin = '', residentId = 0, planId = 0, seq = 0;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const unique = () => `RW-${Date.now()}-${++seq}`;
const api = (method: 'get' | 'post' | 'patch', path: string, token: string, body?: any) => request(app)[method](`/api/v1${path}`).set(auth(token)).send(body);
async function fixture(capacity = 10, customPlanId?: number, future?: Date) {
  const area = await prisma.parkingArea.create({ data: { code: unique(), name: 'Bãi audit thực tế', location: 'B1', capacity } });
  const vehicle = await prisma.vehicle.create({ data: { residentId, licensePlate: unique(), normalizedPlate: unique(), type: 'MOTORBIKE' } });
  const response = await api('post', '/registrations', resident, { vehicleId: vehicle.id, planId: customPlanId ?? planId, areaId: area.id, requestedStartDate: future?.toISOString() });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { area, vehicle, registration: response.body.data };
}
async function issue(f: Awaited<ReturnType<typeof fixture>>) {
  const approval = await api('patch', `/registrations/${f.registration.id}/approve`, manager);
  expect(approval.status, JSON.stringify(approval.body)).toBe(200);
  const paid = await api('post', '/payments', manager, { registrationId: f.registration.id, method: 'CASH', status: 'PAID', idempotencyKey: unique() });
  expect(paid.status, JSON.stringify(paid.body)).toBe(201);
  return paid.body.data;
}

describe('Các quy tắc gửi xe tháng trong thực tế', () => {
  beforeAll(async () => {
    for (const [email, role] of [['resident5@parking.local', 'resident'], ['manager1@parking.local', 'manager'], ['guard1@parking.local', 'guard'], ['admin@parking.local', 'admin']]) {
      const login = await api('post', '/auth/login', '', { email, password: 'Parking@123' });
      expect(login.status).toBe(200);
      if (role === 'resident') { resident = login.body.data.accessToken; residentId = login.body.data.user.resident.id; }
      if (role === 'manager') manager = login.body.data.accessToken;
      if (role === 'guard') guard = login.body.data.accessToken;
      if (role === 'admin') admin = login.body.data.accessToken;
    }
    planId = (await prisma.parkingPlan.findUniqueOrThrow({ where: { code: 'XM-1T' } })).id;
  });
  afterAll(() => prisma.$disconnect());

  it('Ngày cuối tháng được chặn về cuối tháng sau, đúng múi giờ Việt Nam', () => {
    expect(addMonths(new Date('2026-01-31T23:00:00+07:00'), 1).toISOString()).toBe('2026-02-28T16:00:00.000Z');
    expect(addMonths(new Date('2028-01-31T00:00:00+07:00'), 1).toISOString()).toBe('2028-02-28T17:00:00.000Z');
    expect(startOfDay(new Date('2026-10-10T18:00:00Z')).toISOString()).toBe('2026-10-10T17:00:00.000Z');
  });
  it('Gói ba tháng thu ba tháng; giá đã chốt không đổi khi sửa giá gói', async () => {
    const plan = await prisma.parkingPlan.create({ data: { code: unique(), name: 'Gói ba tháng', vehicleType: 'MOTORBIKE', monthlyPrice: 100000, durationMonths: 3 } });
    const f = await fixture(10, plan.id);
    expect(Number(f.registration.quotedAmount)).toBe(300000);
    await api('patch', `/plans/${plan.id}`, manager, { monthlyPrice: 200000 });
    const paid = await issue(f);
    expect(Number(paid.payment.amount)).toBe(300000);
    expect(new Date(paid.ticket.endDate).getTime()).toBe(addMonths(new Date(paid.ticket.startDate), 3).getTime());
    expect((await api('patch', `/plans/${plan.id}`, manager, { durationMonths: 1 })).body.errorCode).toBe('PLAN_HAS_HISTORY');
  });
  it('Giá theo bãi được ưu tiên; giá kết thúc đúng lúc giá mới bắt đầu không bị chồng', async () => {
    const plan = await prisma.parkingPlan.create({ data: { code: unique(), name: 'Giá audit', vehicleType: 'MOTORBIKE', monthlyPrice: 100000, durationMonths: 2 } });
    const area = await prisma.parkingArea.create({ data: { code: unique(), name: 'Giá theo bãi', location: 'B1', capacity: 5 } });
    const boundary = new Date(Date.now() + 86400000);
    await prisma.priceConfig.create({ data: { planId: plan.id, amount: 80000, effectiveFrom: new Date(Date.now() - 86400000) } });
    await prisma.priceConfig.create({ data: { planId: plan.id, areaId: area.id, amount: 70000, effectiveFrom: new Date(), effectiveTo: boundary } });
    await prisma.priceConfig.create({ data: { planId: plan.id, areaId: area.id, amount: 90000, effectiveFrom: boundary } });
    const v = await prisma.vehicle.create({ data: { residentId, licensePlate: unique(), normalizedPlate: unique(), type: 'MOTORBIKE' } });
    const r = await api('post', '/registrations', resident, { vehicleId: v.id, planId: plan.id, areaId: area.id, requestedStartDate: boundary });
    expect(r.status).toBe(201); expect(Number(r.body.data.quotedAmount)).toBe(180000);
  });
  it('Đã duyệt chờ tiền vẫn chặn đăng ký trùng và giữ slot cuối', async () => {
    const f = await fixture(1);
    expect((await api('patch', `/registrations/${f.registration.id}/approve`, manager)).status).toBe(200);
    expect((await api('post', '/registrations', resident, { vehicleId: f.vehicle.id, planId, areaId: f.area.id })).body.errorCode).toBe('OPEN_REGISTRATION_EXISTS');
    const another = await prisma.vehicle.create({ data: { residentId, licensePlate: unique(), normalizedPlate: unique(), type: 'MOTORBIKE' } });
    const r = await api('post', '/registrations', resident, { vehicleId: another.id, planId, areaId: f.area.id });
    expect((await api('patch', `/registrations/${r.body.data.id}/approve`, manager)).body.errorCode).toBe('PARKING_FULL');
    expect((await api('patch', `/areas/${f.area.id}`, manager, { capacity: 0 })).body.errorCode).toBe('CAPACITY_BELOW_RESERVED');
  });
  it('Hai quản lý duyệt hai xe tranh một chỗ: chỉ một hồ sơ được duyệt', async () => {
    const f = await fixture(1);
    const another = await prisma.vehicle.create({ data: { residentId, licensePlate: unique(), normalizedPlate: unique(), type: 'MOTORBIKE' } });
    const r = await api('post', '/registrations', resident, { vehicleId: another.id, planId, areaId: f.area.id });
    const results = await Promise.all([api('patch', `/registrations/${f.registration.id}/approve`, manager), api('patch', `/registrations/${r.body.data.id}/approve`, manager)]);
    expect(results.map(x => x.status).sort()).toEqual([200, 409]);
  });
  for (const kind of ['area', 'plan', 'resident', 'vehicle'] as const) {
    it(`Duyệt và thu tiền phải kiểm tra lại ${kind} ngừng hoạt động`, async () => {
      const localPlan = await prisma.parkingPlan.create({ data: { code: unique(), name: 'Eligibility', vehicleType: 'MOTORBIKE', monthlyPrice: 120000, durationMonths: 1 } });
      const f = await fixture(10, localPlan.id);
      const change = async (status: 'ACTIVE' | 'INACTIVE') => {
        if (kind === 'area') await prisma.parkingArea.update({ where: { id: f.area.id }, data: { status } });
        if (kind === 'plan') await prisma.parkingPlan.update({ where: { id: localPlan.id }, data: { status } });
        if (kind === 'resident') await prisma.resident.update({ where: { id: residentId }, data: { status } });
        if (kind === 'vehicle') await prisma.vehicle.update({ where: { id: f.vehicle.id }, data: { status } });
      };
      try {
        await change('INACTIVE'); expect((await api('patch', `/registrations/${f.registration.id}/approve`, manager)).status).toBe(409);
        await change('ACTIVE'); expect((await api('patch', `/registrations/${f.registration.id}/approve`, manager)).status).toBe(200);
        await change('INACTIVE'); expect((await api('post', '/payments', manager, { registrationId: f.registration.id, method: 'CASH' })).status).toBe(409);
        expect(await prisma.payment.count({ where: { registrationId: f.registration.id } })).toBe(0);
      } finally { await change('ACTIVE'); }
    });
  }
  it('Không thu tiền hồ sơ quá hạn; cron hủy hồ sơ và giao dịch treo', async () => {
    const f = await fixture(); await api('patch', `/registrations/${f.registration.id}/approve`, manager);
    const pending = await api('post', '/payments', manager, { registrationId: f.registration.id, method: 'BANK_TRANSFER', status: 'PENDING' });
    await prisma.parkingRegistration.update({ where: { id: f.registration.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api('patch', `/payments/${pending.body.data.payment.id}/status`, manager, { status: 'PAID' })).body.errorCode).toBe('REGISTRATION_EXPIRED');
    await processTicketExpiry();
    expect((await prisma.parkingRegistration.findUniqueOrThrow({ where: { id: f.registration.id } })).status).toBe('CANCELLED');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pending.body.data.payment.id } })).status).toBe('FAILED');
  });
  it('Thanh toán kiểm tra lại sức chứa và rollback toàn bộ khi hết chỗ', async () => {
    const f = await fixture(1); await api('patch', `/registrations/${f.registration.id}/approve`, manager);
    await prisma.parkingArea.update({ where: { id: f.area.id }, data: { capacity: 0 } });
    expect((await api('post', '/payments', manager, { registrationId: f.registration.id, method: 'CASH' })).status).toBe(409);
    expect(await prisma.payment.count({ where: { registrationId: f.registration.id } })).toBe(0);
    expect(await prisma.parkingTicket.count({ where: { registrationId: f.registration.id } })).toBe(0);
  });
  it('Retry thanh toán đồng thời chỉ tạo một giao dịch và một vé', async () => {
    const f = await fixture(); await api('patch', `/registrations/${f.registration.id}/approve`, manager);
    const body = { registrationId: f.registration.id, method: 'CASH', status: 'PAID', idempotencyKey: unique() };
    const results = await Promise.all([api('post', '/payments', manager, body), api('post', '/payments', manager, body)]);
    expect(results.map(x => x.status)).toEqual([201, 201]);
    expect(results[0]!.body.data.ticket.id).toBe(results[1]!.body.data.ticket.id);
    expect(await prisma.payment.count({ where: { registrationId: f.registration.id } })).toBe(1);
  });
  it('Hủy và thu tiền đồng thời không tạo đăng ký hủy kèm vé đã thu tiền', async () => {
    const f = await fixture(); await api('patch', `/registrations/${f.registration.id}/approve`, manager);
    const results = await Promise.all([api('patch', `/registrations/${f.registration.id}/cancel`, resident), api('post', '/payments', manager, { registrationId: f.registration.id, method: 'CASH' })]);
    expect(results.filter(x => x.status >= 200 && x.status < 300)).toHaveLength(1);
    const reg = await prisma.parkingRegistration.findUniqueOrThrow({ where: { id: f.registration.id }, include: { ticket: true, payments: true } });
    if (reg.status === 'CANCELLED') { expect(reg.ticket).toBeNull(); expect(reg.payments).toHaveLength(0); }
    else { expect(reg.status).toBe('APPROVED'); expect(reg.ticket).not.toBeNull(); }
  });
  it('Gia hạn vé hết hạn bắt đầu từ hiện tại; thu tiền trễ không làm mất ngày sử dụng', async () => {
    const f = await fixture(), paid = await issue(f);
    await prisma.parkingTicket.update({ where: { id: paid.ticket.id }, data: { startDate: new Date(Date.now() - 40 * 86400000), endDate: new Date(Date.now() - 10 * 86400000), status: 'EXPIRED', activeVehicleKey: null } });
    const before = Date.now();
    const renewal = await api('post', `/tickets/${paid.ticket.id}/renew`, resident, {});
    expect(renewal.status).toBe(201); expect(new Date(renewal.body.data.requestedStartDate).getTime()).toBeGreaterThanOrEqual(before);
    await prisma.parkingRegistration.update({ where: { id: renewal.body.data.id }, data: { requestedStartDate: new Date(Date.now() - 5 * 86400000) } });
    await api('patch', `/registrations/${renewal.body.data.id}/approve`, manager);
    const next = await api('post', '/payments', manager, { registrationId: renewal.body.data.id, method: 'CASH' });
    expect(next.status, JSON.stringify(next.body)).toBe(201); expect(new Date(next.body.data.ticket.startDate).getTime()).toBeGreaterThanOrEqual(before);
  });
  it('Gia hạn tại bãi đầy nối tiếp vé cũ, không tính hai chỗ cùng lúc; chặn gia hạn trùng', async () => {
    const f = await fixture(1), paid = await issue(f);
    const renewal = await api('post', `/tickets/${paid.ticket.id}/renew`, resident, {});
    expect(renewal.status).toBe(201);
    expect((await api('patch', `/registrations/${renewal.body.data.id}/approve`, manager)).status).toBe(200);
    const next = await api('post', '/payments', manager, { registrationId: renewal.body.data.id, method: 'CASH' });
    expect(next.status, JSON.stringify(next.body)).toBe(201); expect(next.body.data.ticket.startDate).toBe(paid.ticket.endDate); expect(next.body.data.ticket.status).toBe('PENDING');
    expect((await api('post', `/tickets/${paid.ticket.id}/renew`, resident, {})).body.errorCode).toBe('TICKET_PERIOD_OVERLAP');
  });
  it('Vé đến hạn được kích hoạt ngay khi lấy QR, không phải đợi cron ban đêm', async () => {
    const f = await fixture(1, undefined, new Date(Date.now() + 86400000)), paid = await issue(f);
    await prisma.parkingTicket.update({ where: { id: paid.ticket.id }, data: { startDate: new Date(Date.now() - 1000) } });
    expect((await api('get', `/tickets/${paid.ticket.id}/qr`, resident)).status).toBe(200);
  });
  it('Vé khóa không được lách bằng gia hạn hoặc đăng ký trực tiếp previousTicketId', async () => {
    const f = await fixture(), paid = await issue(f);
    await api('patch', `/tickets/${paid.ticket.id}/lock`, manager, { reason: 'Đang xác minh' });
    expect((await api('post', `/tickets/${paid.ticket.id}/renew`, resident, {})).status).toBe(409);
    expect((await api('post', '/registrations', resident, { vehicleId: f.vehicle.id, planId, areaId: f.area.id, previousTicketId: paid.ticket.id })).status).toBe(409);
  });
  it('Vé đã hoàn tiền không được thu tiền lần nữa cho cùng hồ sơ', async () => {
    const f = await fixture(), paid = await issue(f);
    expect((await api('patch', `/payments/${paid.payment.id}/status`, manager, { status: 'REFUNDED' })).status).toBe(200);
    expect((await api('post', '/payments', manager, { registrationId: f.registration.id, method: 'CASH' })).status).toBe(409);
    expect(await prisma.payment.count({ where: { registrationId: f.registration.id, status: 'PAID' } })).toBe(0);
  });
  it('Xe đỗ nhiều ngày vẫn giữ chỗ; vé hết hạn cho ra nhưng chặn vào', async () => {
    const f = await fixture(), paid = await issue(f);
    const entry = await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' });
    expect(entry.status).toBe(201);
    await prisma.parkingSession.update({ where: { id: entry.body.data.id }, data: { checkInAt: new Date(Date.now() - 7 * 86400000) } });
    await prisma.parkingTicket.update({ where: { id: paid.ticket.id }, data: { startDate: new Date(Date.now() - 30 * 86400000), endDate: new Date(Date.now() - 1000) } });
    await processTicketExpiry();
    const session = await prisma.parkingSession.findUniqueOrThrow({ where: { id: entry.body.data.id } });
    expect(session.status).toBe('PARKING'); expect(session.openVehicleKey).not.toBeNull(); expect(session.checkOutAt).toBeNull();
    expect((await api('post', '/parking/verify-qr', guard, { qrToken: paid.ticket.qrToken, mode: 'OUT' })).status).toBe(200);
    expect((await api('post', '/parking/check-out', guard, { qrToken: paid.ticket.qrToken, gate: 'A2' })).status).toBe(200);
    expect((await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' })).body.errorCode).toBe('TICKET_EXPIRED');
  });
  it('Check-in chặn bãi ngừng hoạt động và sai biển số quan sát', async () => {
    const f = await fixture(), paid = await issue(f);
    expect((await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1', licensePlate: 'NOT-THIS-CAR' })).body.errorCode).toBe('VEHICLE_MISMATCH');
    await prisma.parkingArea.update({ where: { id: f.area.id }, data: { status: 'INACTIVE' } });
    expect((await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' })).body.errorCode).toBe('PARKING_UNAVAILABLE');
  });
  it('RequestId quét không dùng lại cho xe khác; danh sách lượt gửi không lộ token QR', async () => {
    const a = await fixture(), b = await fixture(), paidA = await issue(a), paidB = await issue(b), requestId = unique();
    expect((await api('post', '/parking/check-in', guard, { qrToken: paidA.ticket.qrToken, gate: 'A1', requestId })).status).toBe(201);
    expect((await api('post', '/parking/check-in', guard, { qrToken: paidB.ticket.qrToken, gate: 'A1', requestId })).body.errorCode).toBe('IDEMPOTENCY_KEY_REUSED');
    const sessions = await api('get', '/parking/sessions', guard);
    expect(sessions.body.data.every((s: any) => s.ticket.qrToken === undefined)).toBe(true);
  });
  it('Hiệu chỉnh không được mở lại lượt đã đóng, sai giờ hoặc xóa dấu vết ra bãi', async () => {
    const f = await fixture(), paid = await issue(f);
    const entry = await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' });
    expect((await api('patch', `/parking/sessions/${entry.body.data.id}/correct`, manager, { status: 'COMPLETED', reason: 'Kiểm thử' })).body.errorCode).toBe('SESSION_TRANSITION_FORBIDDEN');
    await api('post', `/parking/sessions/${entry.body.data.id}/manual-checkout`, manager, { gate: 'A2', reason: 'Đã đối chiếu camera' });
    for (const change of [{ status: 'PARKING' }, { checkOutAt: null }, { checkOutAt: new Date(Date.now() - 86400000).toISOString() }]) {
      expect((await api('patch', `/parking/sessions/${entry.body.data.id}/correct`, manager, { ...change, reason: 'Kiểm thử hiệu chỉnh' })).status).toBeGreaterThanOrEqual(400);
    }
  });
  it('Checkout thường và thủ công đồng thời chỉ đóng lượt một lần', async () => {
    const f = await fixture(), paid = await issue(f);
    const entry = await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' });
    const results = await Promise.all([api('post', '/parking/check-out', guard, { qrToken: paid.ticket.qrToken, gate: 'A2' }), api('post', `/parking/sessions/${entry.body.data.id}/manual-checkout`, manager, { gate: 'M2', reason: 'Đối chiếu tại cổng' })]);
    expect(results.map(x => x.status).sort()).toEqual([200, 409]);
  });
  it('Sửa mô tả xe đang có vé được phép; đổi danh tính xe có lịch sử bị chặn', async () => {
    const f = await fixture(), paid = await issue(f);
    expect((await api('patch', `/vehicles/${f.vehicle.id}`, resident, { licensePlate: f.vehicle.licensePlate, type: 'MOTORBIKE', color: 'Xanh' })).status).toBe(200);
    await api('patch', `/tickets/${paid.ticket.id}/cancel`, manager);
    expect((await api('patch', `/vehicles/${f.vehicle.id}`, resident, { licensePlate: 'NEW-12345' })).body.errorCode).toBe('VEHICLE_HAS_HISTORY');
    expect((await api('patch', `/vehicles/${f.vehicle.id}`, resident, { status: 'INACTIVE' })).status).toBe(200);
  });
  it('Không mất quản trị viên cuối cùng; đổi staff sang cư dân phải có hồ sơ', async () => {
    const root = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@parking.local' } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'guard2@parking.local' } });
    expect((await api('patch', `/users/${root.id}`, admin, { status: 'LOCKED' })).body.errorCode).toBe('LAST_ACTIVE_ADMIN');
    expect((await api('patch', `/users/${staff.id}`, admin, { role: 'RESIDENT' })).body.errorCode).toBe('RESIDENT_PROFILE_REQUIRED');
    expect((await api('patch', `/residents/${residentId}`, resident, { apartmentId: 999999 })).status).toBe(403);
  });
  it('Biên bản gắn vé/lượt không khớp bị từ chối; đã xử lý không sửa mức phạt', async () => {
    const f = await fixture(), paid = await issue(f);
    const entry = await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' });
    const requestId = unique();
    const body = { vehicleId: f.vehicle.id, ticketId: paid.ticket.id, sessionId: entry.body.data.id, type: 'OTHER', description: 'Đỗ xe sai vị trí', requestId };
    const first = await api('post', '/violations', guard, body); expect(first.status).toBe(201);
    expect((await api('post', '/violations', guard, { ...body, description: 'Một sự việc khác' })).body.errorCode).toBe('IDEMPOTENCY_KEY_REUSED');
    await api('patch', `/violations/${first.body.data.id}/resolve`, manager, { resolution: 'Đã đối soát và nhắc nhở' });
    expect((await api('patch', `/violations/${first.body.data.id}`, manager, { fineAmount: 500000 })).body.errorCode).toBe('VIOLATION_ALREADY_RESOLVED');
  });
  it('Hủy vé gốc giải phóng yêu cầu gia hạn chưa trả tiền', async () => {
    const f = await fixture(1), paid = await issue(f);
    const renewal = await api('post', `/tickets/${paid.ticket.id}/renew`, resident, {});
    expect((await api('patch', `/registrations/${renewal.body.data.id}/approve`, manager)).status).toBe(200);
    expect((await api('patch', `/tickets/${paid.ticket.id}/cancel`, manager)).status).toBe(200);
    const pending = await prisma.parkingRegistration.findUniqueOrThrow({ where: { id: renewal.body.data.id } });
    expect(pending.status).toBe('CANCELLED'); expect(pending.openRequestKey).toBeNull();
  });
  it('Cư dân không đọc danh sách căn hộ/hồ sơ người khác hoặc tự nhận căn hộ khi đăng ký', async () => {
    expect((await api('get', '/apartments', resident)).status).toBe(403);
    expect((await api('get', '/apartments', guard)).status).toBe(403);
    const apartment = await prisma.apartment.findFirstOrThrow();
    expect((await api('post', '/auth/register', '', { email: `${unique()}@example.com`, fullName: 'Tự nhận căn hộ', password: 'Parking@123', apartmentId: apartment.id })).status).toBe(403);
  });
  it('Tài khoản RESIDENT thiếu hồ sơ không thể dùng token để xem toàn bộ xe', async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'guard2@parking.local' } });
    const logged = await api('post', '/auth/login', '', { email: staff.email, password: 'Parking@123' });
    try {
      await prisma.user.update({ where: { id: staff.id }, data: { role: 'RESIDENT' } });
      expect((await api('get', '/vehicles', logged.body.data.accessToken)).status).toBe(401);
    } finally { await prisma.user.update({ where: { id: staff.id }, data: { role: 'GUARD' } }); }
  });
  it('Hai hồ sơ cư dân không nhập điện thoại/CCCD vẫn tạo được riêng biệt', async () => {
    for (let index = 0; index < 2; index++) {
      const created = await api('post', '/residents', manager, { email: `${unique()}@example.com`, password: 'Parking@123', fullName: 'Cư dân chưa nhập số', phone: '', identityNumber: '', apartmentId: null });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
    }
  });
  it('Lượt ABNORMAL cũ thiếu giờ ra vẫn chiếm chỗ và có thể xác minh thủ công', async () => {
    const f = await fixture(1), paid = await issue(f);
    const entered = await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' });
    await prisma.parkingSession.update({ where: { id: entered.body.data.id }, data: { status: 'ABNORMAL', openVehicleKey: null, abnormalReason: 'Cron cũ đánh dấu quá 24h' } });
    expect((await api('post', '/parking/check-in', guard, { qrToken: paid.ticket.qrToken, gate: 'A1' })).body.errorCode).toBe('ALREADY_PARKING');
    const report = await api('get', '/reports/parking', manager);
    expect(report.body.data.find((a: any) => a.id === f.area.id)._count.sessions).toBe(1);
    expect((await api('post', `/parking/sessions/${entered.body.data.id}/manual-checkout`, manager, { gate: 'A2', reason: 'Đã đối chiếu camera và chủ xe' })).status).toBe(200);
    expect((await prisma.parkingSession.findUniqueOrThrow({ where: { id: entered.body.data.id } })).checkOutAt).not.toBeNull();
  });
  it('Tra xe theo biển số cho bảo vệ chỉ trả dữ liệu cần đối chiếu, không lộ hồ sơ chủ xe', async () => {
    const vehicle = await api('post', '/vehicles', resident, { licensePlate: `49A-${String(Date.now()).slice(-5)}`, type: 'MOTORBIKE' });
    expect(vehicle.status).toBe(201);
    const lookup = await api('get', `/parking/vehicles/lookup?licensePlate=${encodeURIComponent(vehicle.body.data.licensePlate)}`, guard);
    expect(lookup.status).toBe(200); expect(lookup.body.data.id).toBe(vehicle.body.data.id);
    expect(lookup.body.data.residentId).toBeUndefined(); expect(lookup.body.data.qrToken).toBeUndefined();
    expect((await api('get', `/parking/vehicles/lookup?licensePlate=${encodeURIComponent(vehicle.body.data.licensePlate)}`, resident)).status).toBe(403);
  });
  it('Từ chối ngày lịch không tồn tại và diễn giải ngày giá theo múi giờ Việt Nam', async () => {
    const f = await fixture();
    const invalid = await api('post', '/registrations', resident, { vehicleId: f.vehicle.id, planId, areaId: f.area.id, requestedStartDate: '2027-02-30' });
    expect(invalid.status).toBe(422);
    const price = await api('post', '/prices', manager, { planId, areaId: f.area.id, amount: 100000, effectiveFrom: '2027-01-01', effectiveTo: '2027-02-01' });
    expect(price.status).toBe(201); expect(price.body.data.effectiveFrom).toBe('2026-12-31T17:00:00.000Z');
  });
  it('Quản lý khóa xác minh sau báo mất thì cư dân không thể tự cấp QR để mở khóa', async () => {
    const f = await fixture(), paid = await issue(f);
    expect((await api('post', `/tickets/${paid.ticket.id}/report-lost`, resident)).status).toBe(200);
    expect((await api('patch', `/tickets/${paid.ticket.id}/lock`, manager, { reason: 'Đang xác minh tranh chấp chủ xe' })).status).toBe(200);
    expect((await api('post', `/tickets/${paid.ticket.id}/regenerate-qr`, resident)).body.errorCode).toBe('NOT_REPORTED_LOST');
  });
});
