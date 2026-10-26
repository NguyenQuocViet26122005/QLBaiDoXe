import { prisma } from '../config/database.js';
import { occupiedVehicles, openSessionWhere } from './business-rules.js';
export const reportService = {
  async dashboard() {
    const now = new Date(), soon = new Date(Date.now() + 7 * 86400000);
    const [residents, vehicles, activeTickets, expiredTickets, expiring, parked, revenue, violations, capacity] = await Promise.all([
      prisma.resident.count(), prisma.vehicle.count(),
      prisma.parkingTicket.count({ where: { status: { in: ['ACTIVE', 'PENDING'] }, startDate: { lte: now }, endDate: { gt: now } } }),
      prisma.parkingTicket.count({ where: { OR: [{ status: 'EXPIRED' }, { status: { in: ['ACTIVE', 'PENDING', 'LOCKED'] }, endDate: { lte: now } }] } }),
      prisma.parkingTicket.count({ where: { status: { in: ['ACTIVE', 'PENDING'] }, startDate: { lte: now }, endDate: { gt: now, lte: soon } } }),
      prisma.parkingSession.findMany({ where: openSessionWhere, select: { vehicleId: true }, distinct: ['vehicleId'] }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
      prisma.violation.count({ where: { status: 'OPEN' } }),
      prisma.parkingArea.aggregate({ _sum: { capacity: true } }),
    ]);
    const totalCapacity = capacity._sum.capacity ?? 0;
    return { residents, vehicles, activeTickets, expiredTickets, expiringTickets: expiring, vehiclesParking: parked.length, revenue: revenue._sum.amount ?? 0, openViolations: violations, parkingUsageRate: totalCapacity ? Number((parked.length / totalCapacity * 100).toFixed(2)) : 0 };
  },
  revenue() { return prisma.payment.groupBy({ by: ['method'], where: { status: 'PAID' }, _sum: { amount: true }, _count: true }); },
  async parking() {
    const areas = await prisma.parkingArea.findMany();
    return Promise.all(areas.map(async area => ({ ...area, _count: { sessions: await occupiedVehicles(prisma, area.id) } })));
  },
  violations() { return prisma.violation.groupBy({ by: ['type', 'status'], _count: true }); },
};
