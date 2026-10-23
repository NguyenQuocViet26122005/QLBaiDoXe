import { prisma } from '../config/database.js';
export const vehicleRepository={byId:(id:number)=>prisma.vehicle.findUnique({where:{id},include:{resident:true}}),byPlate:(normalizedPlate:string)=>prisma.vehicle.findUnique({where:{normalizedPlate}})};
