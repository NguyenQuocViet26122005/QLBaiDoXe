import { prisma } from '../src/config/database.js';
import { occupiedVehicles, peakOccupancy, reservationIntervals } from '../src/services/business-rules.js';

// Read-only diagnostics. Never infer or rewrite a historical checkout from elapsed time.
try {
  const now = new Date();
  const [unclosedAbnormal, paidWithoutTicket, cancelledWithPayment, missingResidentProfile, overdueStatus, areas] = await Promise.all([
    prisma.parkingSession.findMany({ where: { status: 'ABNORMAL', checkOutAt: null }, select: { id: true, vehicleId: true } }),
    prisma.payment.findMany({ where: { status: 'PAID', ticketId: null }, select: { id: true, registrationId: true } }),
    prisma.parkingRegistration.findMany({ where: { status: 'CANCELLED', payments: { some: { status: 'PAID' } } }, select: { id: true } }),
    prisma.user.findMany({ where: { role: 'RESIDENT', resident: { is: null } }, select: { id: true } }),
    prisma.parkingTicket.count({ where: { status: { in: ['ACTIVE', 'PENDING', 'LOCKED'] }, endDate: { lte: now } } }),
    prisma.parkingArea.findMany({ select: { id: true, capacity: true } }),
  ]);
  const capacityConflicts = [];
  for (const area of areas) {
    const intervals = await reservationIntervals(prisma, area.id, now);
    const reserved = peakOccupancy(intervals, now, new Date('9999-12-31'));
    const parked = await occupiedVehicles(prisma, area.id);
    if (reserved > area.capacity || parked > area.capacity) capacityConflicts.push({ areaId: area.id, capacity: area.capacity, reservedPeak: reserved, parked });
  }
  const overlappingTickets = await prisma.$queryRaw<{ firstId: number; secondId: number }[]>`
    SELECT a.id AS firstId, b.id AS secondId FROM ParkingTicket a JOIN ParkingTicket b
    ON a.vehicleId = b.vehicleId AND a.id < b.id
    WHERE a.status IN ('ACTIVE','LOCKED','PENDING') AND b.status IN ('ACTIVE','LOCKED','PENDING')
    AND a.endDate > ${now} AND b.endDate > ${now}
    AND a.startDate < b.endDate AND b.startDate < a.endDate`;
  console.log(JSON.stringify({ mode: 'READ_ONLY', checkedAt: now.toISOString(), unclosedAbnormal, paidWithoutTicket, cancelledWithPayment, missingResidentProfile, capacityConflicts, overlappingTickets, overdueStatusAwaitingSync: overdueStatus }, null, 2));
} finally { await prisma.$disconnect(); }
