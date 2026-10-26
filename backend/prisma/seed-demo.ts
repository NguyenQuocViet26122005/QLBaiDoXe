/**
 * Dữ liệu mẫu MỞ RỘNG cho trình diễn giao diện (chạy SAU seed.ts gốc).
 *   npm run seed:demo   → chạy seed.ts (xóa & tạo lại) rồi file này.
 * Không thay đổi seed.ts gốc vì bộ test tích hợp phụ thuộc vào nó.
 * Mọi bản ghi tuân thủ cùng ràng buộc mà service đang áp dụng:
 *  - vé ACTIVE/LOCKED giữ activeVehicleKey = ACTIVE:{vehicleId}; EXPIRED/CANCELLED = null
 *  - đăng ký PENDING giữ openRequestKey = OPEN:{vehicleId}; đã xử lý = null
 *  - lượt PARKING giữ openVehicleKey = PARKING:{vehicleId}; lượt đã đóng = null
 *  - quotedAmount = giá tháng × số tháng; thanh toán PAID có paidRegistrationKey = PAID:{registrationId}
 */
import bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { env } from '../src/config/env.js';
import { addMonths } from '../src/utils/date.js';
import { ACTIVE_TICKET_KEY, OPEN_REGISTRATION_KEY, OPEN_SESSION_KEY } from '../src/constants/index.js';
import { normalizePlate, randomToken } from '../src/utils/security.js';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectionLimit: 5 }) });
const passwordHash = await bcrypt.hash('Parking@123', 12);

// Bộ sinh số ngẫu nhiên cố định để mỗi lần seed ra cùng một bộ dữ liệu.
let state = 20261109;
const rand = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const DAY = 86400000;
const now = new Date();
const daysAgo = (d: number, hour = between(6, 21), minute = between(0, 59)) => { const t = new Date(now.getTime() - d * DAY); t.setHours(hour, minute, 0, 0); return t; };
const pad = (n: number, w = 3) => String(n).padStart(w, '0');

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Văn', 'Thị', 'Minh', 'Quốc', 'Thanh', 'Ngọc', 'Hoàng', 'Gia', 'Đức', 'Thu', 'Bảo', 'Anh'];
const TEN = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hiếu', 'Hùng', 'Khang', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trung', 'Tuấn', 'Uyên', 'Vy', 'Yến'];
const BRANDS = { CAR: ['Toyota Vios', 'Hyundai Accent', 'Kia Seltos', 'Mazda CX-5', 'VinFast VF 8', 'Honda City', 'Ford Ranger'], MOTORBIKE: ['Honda Vision', 'Honda Air Blade', 'Yamaha Exciter', 'Honda SH', 'Yamaha Grande', 'Piaggio Liberty'], ELECTRIC_BIKE: ['VinFast Evo200', 'Yadea Odora', 'Pega Cap A'], BICYCLE: ['Giant ATX', 'Trek FX'] } as const;
const COLORS = ['Đen', 'Trắng', 'Bạc', 'Đỏ', 'Xanh dương', 'Xám', 'Cam', 'Nâu'];
const PROVINCES = ['29', '30', '51', '43', '36', '88', '99', '15'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L'];
const GATES = ['GATE_01', 'GATE_02', 'GATE_03'];
const fullName = () => `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
const usedPlates = new Set<string>();
const makePlate = (type: keyof typeof BRANDS) => {
  for (;;) {
    const raw = type === 'CAR' ? `${pick(PROVINCES)}${pick(LETTERS)}${between(10000, 99999)}` : `${pick(PROVINCES)}${pick(LETTERS)}${between(1, 9)}${between(10000, 99999)}`;
    const p = normalizePlate(raw);
    if (!usedPlates.has(p)) { usedPlates.add(p); return p; }
  }
};

async function main() {
  const existing = await prisma.user.count();
  if (!existing) throw new Error('Chưa có dữ liệu gốc. Hãy chạy `npm run prisma:seed` trước (hoặc dùng `npm run seed:demo`).');
  (await prisma.vehicle.findMany({ select: { normalizedPlate: true } })).forEach((v) => usedPlates.add(v.normalizedPlate));

  // Đặt tên người thật cho tài khoản nhân viên gốc (giao diện chào theo tên).
  for (const [email, name] of [['admin@parking.local', 'Nguyễn Minh Quân'], ['manager1@parking.local', 'Trần Thị Ngọc Anh'], ['manager2@parking.local', 'Lê Hoàng Phúc'], ['guard1@parking.local', 'Võ Văn Tâm'], ['guard2@parking.local', 'Bùi Đức Long']] as const) {
    await prisma.user.updateMany({ where: { email }, data: { fullName: name } });
  }
  const staff = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'MANAGER', 'GUARD'] } } });
  const managers = staff.filter((u) => u.role !== 'GUARD');
  const guards = staff.filter((u) => u.role === 'GUARD');

  // ---------- Thêm nhân viên ----------
  for (const [email, name, role] of [['manager3@parking.local', 'Lê Thu Hà', 'MANAGER'], ['guard3@parking.local', 'Phạm Văn Sơn', 'GUARD'], ['guard4@parking.local', 'Đỗ Quốc Hùng', 'GUARD']] as const) {
    const u = await prisma.user.create({ data: { email, fullName: name, role, passwordHash } });
    (role === 'GUARD' ? guards : managers).push(u);
  }

  // ---------- Khu vực & gói ----------
  const areaA = await prisma.parkingArea.findFirstOrThrow({ where: { code: 'AREA-A' } });
  const areaB = await prisma.parkingArea.create({ data: { code: 'AREA-B', name: 'Bãi xe tầng hầm B', location: 'Tầng hầm B2', capacity: 80 } });
  const areaC = await prisma.parkingArea.create({ data: { code: 'AREA-C', name: 'Sân để xe ngoài trời', location: 'Sân sau tòa C', capacity: 40 } });
  await prisma.parkingArea.create({ data: { code: 'AREA-D', name: 'Bãi tạm (đang bảo trì)', location: 'Khu đất trống phía Đông', capacity: 25, status: 'INACTIVE' } });
  const areas = [areaA, areaA, areaB, areaB, areaC];

  const basePlans = await prisma.parkingPlan.findMany();
  const extraPlans = await Promise.all([
    { code: 'XM-3T', name: 'Xe máy 3 tháng', vehicleType: 'MOTORBIKE' as const, monthlyPrice: 110000, durationMonths: 3, description: 'Ưu đãi khi gửi theo quý.' },
    { code: 'OTO-6T', name: 'Ô tô 6 tháng', vehicleType: 'CAR' as const, monthlyPrice: 1100000, durationMonths: 6, description: 'Giảm ~8% so với gói tháng.' },
    { code: 'XDAP-1T', name: 'Xe đạp 1 tháng', vehicleType: 'BICYCLE' as const, monthlyPrice: 50000, durationMonths: 1 }
  ].map((data) => prisma.parkingPlan.create({ data })));
  const plans = [...basePlans, ...extraPlans];
  const planFor = (type: string) => { const options = plans.filter((p) => p.vehicleType === type); return pick(options); };

  // Cấu hình giá riêng cho hầm B (ô tô đắt hơn), áp dụng từ đầu năm.
  const carPlan = plans.find((p) => p.code === 'OTO-1T')!;
  await prisma.priceConfig.create({ data: { planId: carPlan.id, areaId: areaB.id, amount: 1350000, effectiveFrom: new Date(now.getFullYear(), 0, 1) } });

  // ---------- Căn hộ ----------
  const apartments = [];
  for (const building of ['A', 'B', 'C']) {
    for (let floor = 2; floor <= 12; floor += 2) {
      for (const unit of [1, 4]) {
        const apartmentNumber = `${floor}${pad(unit, 2)}`;
        const clash = await prisma.apartment.findUnique({ where: { building_apartmentNumber: { building, apartmentNumber } } });
        if (clash) continue;
        apartments.push(await prisma.apartment.create({ data: { building, floor, apartmentNumber, ownerName: fullName() } }));
      }
    }
  }

  // ---------- Cư dân ----------
  const residents = [];
  for (let i = 0; i < 32; i++) {
    const n = i + 6;
    const user = await prisma.user.create({
      data: {
        email: `resident${n}@parking.local`, fullName: fullName(), phone: `091${pad(n, 7)}`, passwordHash, role: 'RESIDENT', status: i === 31 ? 'LOCKED' : 'ACTIVE',
        resident: { create: { residentCode: `CD${pad(n)}`, apartmentId: apartments[i % apartments.length]!.id, identityNumber: `0792${pad(n, 8)}`, dateOfBirth: new Date(between(1965, 2002), between(0, 11), between(1, 28)), status: i === 30 ? 'INACTIVE' : 'ACTIVE' } }
      },
      include: { resident: true }
    });
    residents.push(user);
  }

  // ---------- Phương tiện ----------
  const vehicles: { id: number; residentId: number; type: keyof typeof BRANDS; userId: number }[] = [];
  for (const [i, r] of residents.entries()) {
    const count = i % 4 === 0 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const type = (k === 0 ? pick(['MOTORBIKE', 'MOTORBIKE', 'CAR', 'ELECTRIC_BIKE'] as const) : pick(['MOTORBIKE', 'CAR', 'BICYCLE'] as const));
      const plate = makePlate(type);
      const [brand, ...model] = pick(BRANDS[type]).split(' ');
      const v = await prisma.vehicle.create({ data: { residentId: r.resident!.id, licensePlate: plate, normalizedPlate: plate, type, brand, model: model.join(' ') || null, color: pick(COLORS) } });
      vehicles.push({ id: v.id, residentId: r.resident!.id, type, userId: r.id });
    }
  }

  // ---------- Đăng ký, vé, thanh toán ----------
  let ticketNo = 100;
  let payNo = 100;
  const activeTickets: { id: number; vehicleId: number; areaId: number }[] = [];
  const allTickets: { id: number; vehicleId: number }[] = [];
  const scenario = (i: number) => {
    if (i < 20) return 'ACTIVE';
    if (i < 24) return 'EXPIRING';
    if (i < 27) return 'EXPIRED';
    if (i < 29) return 'LOCKED';
    if (i < 35) return 'PENDING';
    if (i < 38) return 'REJECTED';
    return 'CANCELLED';
  };

  for (const [i, v] of vehicles.entries()) {
    const kind = scenario(i);
    const plan = planFor(v.type);
    const area = pick(areas);
    const amount = Number(plan.monthlyPrice) * plan.durationMonths;
    const reviewer = pick(managers);

    if (kind === 'PENDING') {
      await prisma.parkingRegistration.create({ data: { residentId: v.residentId, vehicleId: v.id, planId: plan.id, areaId: area.id, quotedAmount: amount, requestedStartDate: daysAgo(-between(1, 10)), expiresAt: new Date(now.getTime() + 30 * DAY), status: 'PENDING', type: 'NEW', note: pick(['Xin gửi từ đầu tháng.', 'Xe mới mua.', null, 'Chuyển từ hầm A sang.']), openRequestKey: OPEN_REGISTRATION_KEY(v.id), createdAt: daysAgo(between(0, 6)) } });
      continue;
    }
    if (kind === 'REJECTED' || kind === 'CANCELLED') {
      await prisma.parkingRegistration.create({ data: { residentId: v.residentId, vehicleId: v.id, planId: plan.id, areaId: area.id, quotedAmount: amount, requestedStartDate: daysAgo(between(10, 40)), expiresAt: daysAgo(between(1, 9)), status: kind, type: 'NEW', reviewerId: kind === 'REJECTED' ? reviewer.id : null, reviewedAt: kind === 'REJECTED' ? daysAgo(between(8, 30)) : null, rejectionReason: kind === 'REJECTED' ? pick(['Biển số không khớp giấy đăng ký xe.', 'Thiếu ảnh cà vẹt xe.', 'Bãi đã đủ chỗ cho loại xe này.']) : null, createdAt: daysAgo(between(10, 45)) } });
      continue;
    }

    // Đăng ký đã duyệt + vé + thanh toán
    let start: Date;
    let end: Date;
    if (kind === 'EXPIRING') { end = new Date(now.getTime() + between(1, 6) * DAY); start = addMonths(end, -plan.durationMonths); }
    else if (kind === 'EXPIRED') { end = daysAgo(between(3, 25)); start = addMonths(end, -plan.durationMonths); }
    else { start = daysAgo(between(2, 25)); end = addMonths(start, plan.durationMonths); }
    const createdAt = new Date(start.getTime() - between(1, 4) * DAY);

    const reg = await prisma.parkingRegistration.create({ data: { residentId: v.residentId, vehicleId: v.id, planId: plan.id, areaId: area.id, quotedAmount: amount, requestedStartDate: start, expiresAt: new Date(createdAt.getTime() + 30 * DAY), status: 'APPROVED', type: i % 5 === 0 ? 'RENEWAL' : 'NEW', reviewerId: reviewer.id, reviewedAt: createdAt, createdAt } });
    const status = kind === 'EXPIRED' ? 'EXPIRED' : kind === 'LOCKED' ? 'LOCKED' : 'ACTIVE';
    ticketNo += 1;
    const ticket = await prisma.parkingTicket.create({ data: { registrationId: reg.id, vehicleId: v.id, planId: plan.id, areaId: area.id, ticketCode: `VE-${now.getFullYear()}-${pad(ticketNo, 4)}`, qrToken: randomToken(), startDate: start, endDate: end, price: amount, status, lockReason: status === 'LOCKED' ? pick(['Cư dân báo mất thẻ QR.', 'Nợ phí gửi xe tháng trước.']) : null, activeVehicleKey: status === 'EXPIRED' ? null : ACTIVE_TICKET_KEY(v.id), createdAt } });
    allTickets.push({ id: ticket.id, vehicleId: v.id });
    if (status === 'ACTIVE') activeTickets.push({ id: ticket.id, vehicleId: v.id, areaId: area.id });
    payNo += 1;
    await prisma.payment.create({ data: { registrationId: reg.id, ticketId: ticket.id, paymentCode: `TT-${now.getFullYear()}-${pad(payNo, 4)}`, amount, method: rand() < 0.62 ? 'BANK_TRANSFER' : 'CASH', status: 'PAID', reference: `CK${between(100000, 999999)}`, paidRegistrationKey: `PAID:${reg.id}`, confirmedById: reviewer.id, paidAt: createdAt, createdAt } });
  }

  // Lịch sử doanh thu 6 tháng trước: các kỳ gia hạn đã hết hạn của các xe đang có vé.
  for (const [k, t] of activeTickets.entries()) {
    const v = vehicles.find((x) => x.id === t.vehicleId)!;
    const months = 1 + (k % 5);
    for (let m = months; m >= 1; m--) {
      const plan = planFor(v.type);
      const start = addMonths(daysAgo(between(2, 25)), -m * plan.durationMonths - 1);
      const end = addMonths(start, plan.durationMonths);
      if (end > now) continue;
      const amount = Number(plan.monthlyPrice) * plan.durationMonths;
      const reviewer = pick(managers);
      const reg = await prisma.parkingRegistration.create({ data: { residentId: v.residentId, vehicleId: v.id, planId: plan.id, areaId: t.areaId, quotedAmount: amount, requestedStartDate: start, expiresAt: addMonths(start, 1), status: 'APPROVED', type: 'RENEWAL', reviewerId: reviewer.id, reviewedAt: start, createdAt: start } });
      ticketNo += 1;
      const old = await prisma.parkingTicket.create({ data: { registrationId: reg.id, vehicleId: v.id, planId: plan.id, areaId: t.areaId, ticketCode: `VE-${start.getFullYear()}-${pad(ticketNo, 4)}`, qrToken: randomToken(), startDate: start, endDate: end, price: amount, status: 'EXPIRED', activeVehicleKey: null, createdAt: start } });
      allTickets.push({ id: old.id, vehicleId: v.id });
      payNo += 1;
      await prisma.payment.create({ data: { registrationId: reg.id, ticketId: old.id, paymentCode: `TT-${start.getFullYear()}-${pad(payNo, 4)}`, amount, method: rand() < 0.6 ? 'BANK_TRANSFER' : 'CASH', status: 'PAID', paidRegistrationKey: `PAID:${reg.id}`, confirmedById: reviewer.id, paidAt: start, createdAt: start } });
    }
  }

  // ---------- Lượt ra vào ----------
  const parkedNow = activeTickets.filter((_, i) => i % 3 !== 2); // ~2/3 xe đang trong bãi
  let sessionCount = 0;
  for (const t of activeTickets) {
    for (let d = between(4, 12); d >= 1; d--) {
      const inAt = daysAgo(d, between(6, 9));
      const outAt = new Date(inAt.getTime() + between(2, 11) * 3600000);
      await prisma.parkingSession.create({ data: { vehicleId: t.vehicleId, ticketId: t.id, areaId: t.areaId, checkInGuardId: pick(guards).id, checkOutGuardId: pick(guards).id, checkInGate: pick(GATES), checkOutGate: pick(GATES), checkInAt: inAt, checkOutAt: outAt, status: 'COMPLETED' } });
      sessionCount += 1;
    }
  }
  const openSessions = [];
  for (const t of parkedNow) {
    openSessions.push(await prisma.parkingSession.create({ data: { vehicleId: t.vehicleId, ticketId: t.id, areaId: t.areaId, checkInGuardId: pick(guards).id, checkInGate: pick(GATES), checkInAt: new Date(now.getTime() - between(20, 600) * 60000), status: 'PARKING', openVehicleKey: OPEN_SESSION_KEY(t.vehicleId) } }));
    sessionCount += 1;
  }
  // Hai lượt ra qua xác minh thủ công (mất QR).
  for (const t of activeTickets.filter((_, i) => i % 3 === 2).slice(0, 2)) {
    const inAt = daysAgo(between(1, 3), 7);
    await prisma.parkingSession.create({ data: { vehicleId: t.vehicleId, ticketId: t.id, areaId: t.areaId, checkInGuardId: pick(guards).id, checkOutGuardId: pick(guards).id, checkInGate: 'GATE_01', checkOutGate: 'GATE_02', checkInAt: inAt, checkOutAt: new Date(inAt.getTime() + 9 * 3600000), status: 'ABNORMAL', abnormalReason: 'Cư dân mất QR, đã đối chiếu CCCD và camera cổng.' } });
    sessionCount += 1;
  }

  // ---------- Vi phạm ----------
  const violationSeeds = [
    ['EXPIRED_TICKET', 'Xe vào bãi khi vé tháng đã hết hạn 3 ngày.', 0, 'OPEN'],
    ['EXPIRED_TICKET', 'Vé hết hạn, cư dân đã gia hạn tại quầy.', 0, 'RESOLVED'],
    ['WRONG_VEHICLE', 'QR của xe máy dùng cho ô tô khác biển số.', 100000, 'OPEN'],
    ['INVALID_QR', 'Quét QR cũ đã bị vô hiệu sau khi báo mất.', 0, 'OPEN'],
    ['UNAUTHORIZED_VEHICLE', 'Xe khách đỗ vào ô dành cho cư dân.', 150000, 'RESOLVED'],
    ['OTHER', 'Đỗ chắn lối thoát hiểm hầm B2.', 200000, 'OPEN'],
    ['OTHER', 'Để xe qua đêm ở làn đường nội bộ.', 50000, 'RESOLVED'],
    ['WRONG_VEHICLE', 'Biển số không khớp với vé đăng ký.', 100000, 'RESOLVED'],
    ['INVALID_QR', 'Mã QR mờ, không đọc được sau 3 lần quét.', 0, 'RESOLVED']
  ] as const;
  for (const [type, description, fine, status] of violationSeeds) {
    const t = pick(allTickets);
    const occurredAt = daysAgo(between(0, 40));
    await prisma.violation.create({ data: { vehicleId: t.vehicleId, ticketId: t.id, guardId: pick(guards).id, type, description, fineAmount: fine || null, occurredAt, status, resolution: status === 'RESOLVED' ? 'Đã nhắc nhở và lập biên bản, cư dân đã khắc phục.' : null, resolvedById: status === 'RESOLVED' ? pick(managers).id : null, resolvedAt: status === 'RESOLVED' ? new Date(occurredAt.getTime() + DAY) : null } });
  }

  // ---------- Thông báo ----------
  const pendingCount = await prisma.parkingRegistration.count({ where: { status: 'PENDING' } });
  const staffNotes = [
    ['SYSTEM', 'Có đăng ký mới cần duyệt', `${pendingCount} hồ sơ gửi xe đang chờ xác minh.`, 0, false],
    ['TICKET_EXPIRING', 'Vé sắp hết hạn', 'Có vé tháng sẽ hết hạn trong 7 ngày tới; hệ thống đã gửi nhắc cư dân.', 1, false],
    ['VIOLATION', 'Vi phạm mới tại hầm B2', 'Bảo vệ vừa lập biên bản đỗ chắn lối thoát hiểm.', 2, false],
    ['SYSTEM', 'Bãi tạm khu Đông tạm ngưng', 'Khu vực AREA-D chuyển sang trạng thái bảo trì.', 26, true],
    ['SYSTEM', 'Đối soát doanh thu tháng trước', 'Báo cáo doanh thu tháng trước đã sẵn sàng.', 72, true]
  ] as const;
  for (const u of managers) {
    for (const [k, [type, title, message, hoursAgo, read]] of staffNotes.entries()) {
      const createdAt = new Date(now.getTime() - hoursAgo * 3600000);
      await prisma.notification.create({ data: { userId: u.id, type, title, message, createdAt, readAt: read ? createdAt : null, dedupKey: `demo-staff-${u.id}-${k}` } });
    }
  }
  for (const v of vehicles.filter((_, i) => scenario(i) === 'EXPIRING')) {
    await prisma.notification.create({ data: { userId: v.userId, residentId: v.residentId, type: 'TICKET_EXPIRING', title: 'Vé tháng sắp hết hạn', message: 'Vé gửi xe của bạn sẽ hết hạn trong vài ngày tới. Vui lòng gia hạn.', dedupKey: `demo-expiring-${v.id}` } });
  }

  const summary = { canHo: apartments.length, cuDan: residents.length, phuongTien: vehicles.length, veActive: activeTickets.length, dangTrongBai: openSessions.length, luotRaVao: sessionCount, viPham: violationSeeds.length, choDuyet: pendingCount };
  console.log('Seed demo hoàn tất:', summary);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
