import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { AppError,forbidden } from '../utils/app-error.js';
type Payload={sub:string;role:UserRole;type:'access'};
export const authenticate:RequestHandler=async(req,_res,next)=>{try{const raw=req.headers.authorization;if(!raw?.startsWith('Bearer '))throw new AppError(401,'UNAUTHORIZED','Thiếu access token');const p=jwt.verify(raw.slice(7),env.JWT_ACCESS_SECRET) as Payload;if(p.type!=='access')throw new Error();const user=await prisma.user.findUnique({where:{id:Number(p.sub)},include:{resident:true}});if(!user||user.status!=='ACTIVE'||(user.role==='RESIDENT'&&(!user.resident||user.resident.status!=='ACTIVE')))throw new Error();req.auth={userId:user.id,role:user.role,residentId:user.resident?.id};next();}catch{next(new AppError(401,'INVALID_TOKEN','Access token không hợp lệ hoặc đã hết hạn'));}};
export const authorize=(...roles:UserRole[]):RequestHandler=>(req,_res,next)=>req.auth&&roles.includes(req.auth.role)?next():next(forbidden());
