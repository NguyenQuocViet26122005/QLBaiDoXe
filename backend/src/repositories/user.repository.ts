import { prisma } from '../config/database.js';
export const userRepository={byEmail:(email:string)=>prisma.user.findUnique({where:{email:email.toLowerCase()},include:{resident:true}}),byId:(id:number)=>prisma.user.findUnique({where:{id},include:{resident:{include:{apartment:true}}}})};
