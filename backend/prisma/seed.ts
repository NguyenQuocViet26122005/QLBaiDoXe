import bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { env } from '../src/config/env.js';
import { addMonths } from '../src/utils/date.js';
import { ACTIVE_TICKET_KEY,OPEN_SESSION_KEY } from '../src/constants/index.js';
import { randomToken } from '../src/utils/security.js';
const prisma=new PrismaClient({adapter:new PrismaMariaDb({host:env.DB_HOST,port:env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectionLimit:5})});
const passwordHash=await bcrypt.hash('Parking@123',12);
async function main(){
  await prisma.$transaction([prisma.auditLog.deleteMany(),prisma.violation.deleteMany(),prisma.parkingSession.deleteMany(),prisma.payment.deleteMany(),prisma.notification.deleteMany(),prisma.refreshToken.deleteMany(),prisma.parkingTicket.deleteMany(),prisma.parkingRegistration.deleteMany(),prisma.priceConfig.deleteMany(),prisma.vehicle.deleteMany(),prisma.parkingPlan.deleteMany(),prisma.parkingArea.deleteMany(),prisma.resident.deleteMany(),prisma.apartment.deleteMany(),prisma.user.deleteMany()]);
  const apartments=await Promise.all(Array.from({length:5},(_,i)=>prisma.apartment.create({data:{building:i<3?'A':'B',floor:i+1,apartmentNumber:`${i+1}0${i+1}`,ownerName:`Chủ hộ ${i+1}`}})));
  const area=await prisma.parkingArea.create({data:{code:'AREA-A',name:'Bãi xe tầng hầm A',location:'Tầng hầm B1',capacity:100}});
  const plans=await Promise.all([{code:'XM-1T',name:'Xe máy 1 tháng',vehicleType:'MOTORBIKE' as const,monthlyPrice:120000,durationMonths:1},{code:'OTO-1T',name:'Ô tô 1 tháng',vehicleType:'CAR' as const,monthlyPrice:1200000,durationMonths:1},{code:'XD-1T',name:'Xe đạp điện 1 tháng',vehicleType:'ELECTRIC_BIKE' as const,monthlyPrice:200000,durationMonths:1}].map(data=>prisma.parkingPlan.create({data})));
  const staff=[['admin@parking.local','Quản trị viên','ADMIN'],['manager1@parking.local','Quản lý Một','MANAGER'],['manager2@parking.local','Quản lý Hai','MANAGER'],['guard1@parking.local','Bảo vệ Một','GUARD'],['guard2@parking.local','Bảo vệ Hai','GUARD']] as const;
  const staffUsers=[];for(const [email,fullName,role] of staff)staffUsers.push(await prisma.user.create({data:{email,fullName,role,passwordHash}}));
  const residents=[];for(let i=0;i<5;i++)residents.push(await prisma.user.create({data:{email:`resident${i+1}@parking.local`,fullName:`Cư dân ${i+1}`,phone:`090000000${i+1}`,passwordHash,role:'RESIDENT',resident:{create:{residentCode:`CD00${i+1}`,apartmentId:apartments[i]!.id,identityNumber:`07920000000${i+1}`}}},include:{resident:true}}));
  const vehicleData=[['30A-12345','CAR'],['29B1-11111','MOTORBIKE'],['29B1-22222','MOTORBIKE'],['30F-67890','CAR'],['29C1-33333','MOTORBIKE'],['29D1-44444','ELECTRIC_BIKE'],['29E1-55555','MOTORBIKE'],['30G-24680','CAR']] as const;
  const vehicles=[];for(let i=0;i<vehicleData.length;i++){const [plate,type]=vehicleData[i]!;vehicles.push(await prisma.vehicle.create({data:{residentId:residents[i%5]!.resident!.id,licensePlate:plate,normalizedPlate:plate,type,brand:type==='CAR'?'Toyota':'Honda',color:'Đen'}}));}
  const now=new Date(),demoStart=new Date(Date.now()-2*86400000);const reg=await prisma.parkingRegistration.create({data:{residentId:residents[0]!.resident!.id,vehicleId:vehicles[0]!.id,planId:plans[1]!.id,areaId:area.id,quotedAmount:plans[1]!.monthlyPrice,requestedStartDate:demoStart,expiresAt:new Date(now.getTime()+30*86400000),status:'APPROVED',type:'NEW',reviewerId:staffUsers[1]!.id,reviewedAt:demoStart}});
  const ticket=await prisma.parkingTicket.create({data:{registrationId:reg.id,vehicleId:vehicles[0]!.id,planId:plans[1]!.id,areaId:area.id,ticketCode:'VE-DEMO-001',qrToken:randomToken(),startDate:demoStart,endDate:addMonths(demoStart,1),price:plans[1]!.monthlyPrice,status:'ACTIVE',activeVehicleKey:ACTIVE_TICKET_KEY(vehicles[0]!.id)}});
  await prisma.payment.create({data:{registrationId:reg.id,ticketId:ticket.id,paymentCode:'TT-DEMO-001',amount:plans[1]!.monthlyPrice,method:'BANK_TRANSFER',status:'PAID',reference:'SEED-DEMO',paidRegistrationKey:`PAID:${reg.id}`,confirmedById:staffUsers[1]!.id,paidAt:demoStart}});
  const session=await prisma.parkingSession.create({data:{vehicleId:vehicles[0]!.id,ticketId:ticket.id,areaId:area.id,checkInGuardId:staffUsers[3]!.id,checkInGate:'GATE_01',status:'PARKING',openVehicleKey:OPEN_SESSION_KEY(vehicles[0]!.id)}});
  await prisma.violation.create({data:{vehicleId:vehicles[1]!.id,guardId:staffUsers[3]!.id,type:'OTHER',description:'Đỗ xe sai vị trí quy định',fineAmount:50000}});
  await prisma.notification.create({data:{userId:residents[0]!.id,residentId:residents[0]!.resident!.id,type:'SYSTEM',title:'Chào mừng',message:'Dữ liệu mẫu đã sẵn sàng.',dedupKey:'seed-welcome'}});
  await prisma.parkingSession.create({data:{vehicleId:vehicles[0]!.id,ticketId:ticket.id,areaId:area.id,checkInGuardId:staffUsers[3]!.id,checkOutGuardId:staffUsers[4]!.id,checkInGate:'GATE_01',checkOutGate:'GATE_02',checkInAt:new Date(now.getTime()-86400000),checkOutAt:new Date(now.getTime()-82800000),status:'COMPLETED',abnormalReason:`Dữ liệu lịch sử minh họa; phiên đang mở là #${session.id}`}});
  console.log('Seed hoàn tất. Mật khẩu chung: Parking@123');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
