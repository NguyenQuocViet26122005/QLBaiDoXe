import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

type Actor={userId:number;role:'RESIDENT'|'GUARD'|'MANAGER'|'ADMIN'};
type AuditInput={action:string;entity:string;entityId:number|string;reason?:string;metadata?:Record<string,unknown>};

export const auditService={
  async list(){
    const rows=await prisma.auditLog.findMany({include:{actor:{select:{id:true,email:true,fullName:true,role:true}}},orderBy:{createdAt:'desc'},take:500});
    return rows.map((row)=>({...row,id:String(row.id)}));
  },
  record(actor:Actor,input:AuditInput,client:any=prisma){
    return client.auditLog.create({data:{actorId:actor.userId,actorRole:actor.role,action:input.action,entity:input.entity,entityId:String(input.entityId),reason:input.reason,metadata:input.metadata}});
  },
  async bestEffort(actor:Actor,input:AuditInput){
    try{return await this.record(actor,input);}catch(error){logger.error({err:error,input},'Audit log write failed');return null;}
  }
};
