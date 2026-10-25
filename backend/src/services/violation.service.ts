import { prisma } from '../config/database.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';
import { lockVehicle, transactionOptions } from './business-rules.js';
const ticketSummary = { select: { id: true, ticketCode: true, status: true } };
export const violationService = {
  list(auth:any){return prisma.violation.findMany({where:auth.role==='RESIDENT'?{vehicle:{residentId:auth.residentId}}:{},include:{vehicle:true,ticket:ticketSummary,guard:{select:{fullName:true}},resolvedBy:{select:{fullName:true}}},orderBy:{occurredAt:'desc'}});},
  async get(auth:any,id:number){const row=await prisma.violation.findUnique({where:{id},include:{vehicle:true,ticket:ticketSummary}});if(!row)throw notFound('Vi phạm');if(auth.role==='RESIDENT'){if(row.vehicle.residentId!==auth.residentId)throw forbidden();}return row;},
  async create(actor:any,input:any){
    const result=await prisma.$transaction(async tx=>{
      await lockVehicle(tx,input.vehicleId);
      if(input.requestId){
        const previous=await tx.violation.findUnique({where:{dedupKey:input.requestId}});
        if(previous){
          if(previous.vehicleId!==input.vehicleId||previous.guardId!==actor.userId||previous.type!==input.type||previous.description!==input.description||previous.ticketId!==(input.ticketId??null)||previous.sessionId!==(input.sessionId??null)||Number(previous.fineAmount??0)!==Number(input.fineAmount??0))throw new AppError(409,'IDEMPOTENCY_KEY_REUSED','Mã yêu cầu đã được dùng cho biên bản khác');
          return {row:previous,resident:null};
        }
      }
      const vehicle=await tx.vehicle.findUnique({where:{id:input.vehicleId},include:{resident:true}});
      if(!vehicle)throw notFound('Xe');
      if(input.ticketId){const ticket=await tx.parkingTicket.findUnique({where:{id:input.ticketId}});if(!ticket||ticket.vehicleId!==vehicle.id)throw new AppError(409,'VIOLATION_TICKET_MISMATCH','Vé không thuộc phương tiện vi phạm');}
      if(input.sessionId){const session=await tx.parkingSession.findUnique({where:{id:input.sessionId}});if(!session||session.vehicleId!==vehicle.id||(input.ticketId&&session.ticketId!==input.ticketId))throw new AppError(409,'VIOLATION_SESSION_MISMATCH','Lượt gửi không khớp phương tiện hoặc vé vi phạm');}
      const {requestId,...data}=input;
      const row=await tx.violation.create({data:{...data,guardId:actor.userId,dedupKey:requestId}});
      await auditService.record(actor,{action:'VIOLATION_CREATE',entity:'Violation',entityId:row.id,reason:input.description},tx);
      return {row,resident:vehicle.resident};
    },transactionOptions);
    if(result.resident)await notificationService.send(result.resident.userId,result.resident.id,'VIOLATION','Biên bản vi phạm mới',input.description,`violation:${result.row.id}`);
    return result.row;
  },
  async update(id:number,input:any,actor:any){return prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT `id` FROM `Violation` WHERE `id` = ? FOR UPDATE',id);
    const row=await tx.violation.findUnique({where:{id}});if(!row)throw notFound('Vi phạm');
    if(row.status!=='OPEN')throw new AppError(409,'VIOLATION_ALREADY_RESOLVED','Không sửa biên bản đã xử lý');
    const updated=await tx.violation.update({where:{id},data:input});
    await auditService.record(actor,{action:'VIOLATION_UPDATE',entity:'Violation',entityId:id,metadata:input},tx);return updated;
  },transactionOptions);},
  async resolve(id:number,actor:any,resolution:string){return prisma.$transaction(async tx=>{const claimed=await tx.violation.updateMany({where:{id,status:'OPEN'},data:{status:'RESOLVED',resolution,resolvedById:actor.userId,resolvedAt:new Date()}});if(claimed.count!==1){if(!await tx.violation.findUnique({where:{id}}))throw notFound('Vi phạm');throw new AppError(409,'VIOLATION_ALREADY_RESOLVED','Biên bản đã được xử lý');}await auditService.record(actor,{action:'VIOLATION_RESOLVE',entity:'Violation',entityId:id,reason:resolution},tx);return tx.violation.findUniqueOrThrow({where:{id}});});}
};
