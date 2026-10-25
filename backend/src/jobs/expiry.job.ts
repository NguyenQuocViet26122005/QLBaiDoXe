import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { daysUntil } from '../utils/date.js';
import { notificationService } from '../services/notification.service.js';
import { lockRegistration, lockVehicle, syncVehicleTickets, transactionOptions } from '../services/business-rules.js';
import { logger } from '../config/logger.js';

export async function processTicketExpiry() {
  const now = new Date();
  const vehicles = await prisma.parkingTicket.findMany({ where: { status: { in: ['ACTIVE', 'PENDING', 'LOCKED'] } }, select: { vehicleId: true }, distinct: ['vehicleId'] });
  for (const { vehicleId } of vehicles) {
    await prisma.$transaction(async tx => { await lockVehicle(tx, vehicleId); await syncVehicleTickets(tx, vehicleId, now); }, transactionOptions);
  }
  const unpaid = await prisma.parkingRegistration.findMany({ where: { status: { in: ['PENDING', 'APPROVED'] }, expiresAt: { lte: now }, ticket: { is: null } }, select: { id: true } });
  for (const { id } of unpaid) {
    await prisma.$transaction(async tx => {
      const row = await lockRegistration(tx, id);
      if (!['PENDING', 'APPROVED'].includes(row.status) || row.expiresAt > now || await tx.parkingTicket.findUnique({ where: { registrationId: id } })) return;
      await tx.parkingRegistration.update({ where: { id }, data: { status: 'CANCELLED', openRequestKey: null } });
      await tx.payment.updateMany({ where: { registrationId: id, status: 'PENDING' }, data: { status: 'FAILED' } });
      await tx.auditLog.create({ data: { actorRole: 'ADMIN', action: 'REGISTRATION_EXPIRE_JOB', entity: 'ParkingRegistration', entityId: String(id), reason: 'Đăng ký hết thời hạn xử lý/thanh toán' } });
    }, transactionOptions);
  }
  const tickets = await prisma.parkingTicket.findMany({ where: { status: { in: ['ACTIVE', 'PENDING', 'LOCKED', 'EXPIRED'] } }, include: { vehicle: { include: { resident: true } } } });
  for (const ticket of tickets) {
    if (ticket.status === 'EXPIRED') {
      await notificationService.send(ticket.vehicle.resident.userId, ticket.vehicle.residentId, 'TICKET_EXPIRED', 'Vé đã hết hạn', `Vé ${ticket.ticketCode} đã hết hạn.`, `expired:${ticket.id}`);
    } else {
      const days = daysUntil(ticket.endDate, now);
      if ([7, 3, 1, 0].includes(days)) await notificationService.send(ticket.vehicle.resident.userId, ticket.vehicle.residentId, 'TICKET_EXPIRING', 'Vé sắp hết hạn', `Vé ${ticket.ticketCode} còn ${days} ngày.`, `expiring:${ticket.id}:${days}`);
    }
  }
  // Monthly residents may park for days or weeks. Only a verified checkout releases a space.
}
let running = false;
export const startExpiryJob = () => {
  if (!env.CRON_ENABLED) return;
  const run = async () => {
    if (running) return;
    running = true;
    try { await processTicketExpiry(); } catch (err) { logger.error({ err }, 'Expiry job failed'); } finally { running = false; }
  };
  void run();
  return cron.schedule('* * * * *', run, { timezone: 'Asia/Ho_Chi_Minh', noOverlap: true });
};
