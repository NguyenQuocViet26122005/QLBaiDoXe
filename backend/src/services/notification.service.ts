import { prisma } from '../config/database.js';
import type { NotificationType } from '../generated/prisma/client.js';
import { logger } from '../config/logger.js';
export const notificationService={
  async send(userId:number,residentId:number|undefined,type:NotificationType,title:string,message:string,dedupKey?:string){try{const user=await prisma.user.findUnique({where:{id:userId},select:{status:true}});if(!user||user.status!=='ACTIVE')return null;return await prisma.notification.create({data:{userId,residentId,type,title,message,dedupKey}});}catch(error:any){if(error?.code==='P2002')return null;logger.error({err:error,userId,type,dedupKey},'Notification delivery failed');return null;}},
  list(userId:number){return prisma.notification.findMany({where:{userId},orderBy:{createdAt:'desc'}});},
  read(userId:number,id:number){return prisma.notification.updateMany({where:{id,userId},data:{readAt:new Date()}});},
  readAll(userId:number){return prisma.notification.updateMany({where:{userId,readAt:null},data:{readAt:new Date()}});}
};
