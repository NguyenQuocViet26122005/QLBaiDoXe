import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError,notFound } from '../utils/app-error.js';
import { code,hashToken,randomToken } from '../utils/security.js';
import { userRepository } from '../repositories/user.repository.js';

const publicUser=(u:any)=>({id:u.id,email:u.email,fullName:u.fullName,phone:u.phone,role:u.role,status:u.status,resident:u.resident});
const access=(u:{id:number;role:string})=>jwt.sign({role:u.role,type:'access'},env.JWT_ACCESS_SECRET,{subject:String(u.id),expiresIn:env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn']});
const issueRefresh=async(userId:number)=>{const raw=randomToken();await prisma.refreshToken.create({data:{userId,tokenHash:hashToken(raw),expiresAt:new Date(Date.now()+env.REFRESH_TOKEN_EXPIRES_DAYS*86400000)}});return raw;};
export const authService={
  async register(input:any){if(input.apartmentId)throw new AppError(403,'APARTMENT_REQUIRES_VERIFICATION','Liên hệ quản lý để xác minh và liên kết căn hộ');if(await userRepository.byEmail(input.email))throw new AppError(409,'EMAIL_EXISTS','Email đã được sử dụng');const passwordHash=await bcrypt.hash(input.password,12);const user=await prisma.user.create({data:{email:input.email.toLowerCase(),passwordHash,fullName:input.fullName,phone:input.phone,role:'RESIDENT',resident:{create:{residentCode:code('CD'),apartmentId:input.apartmentId,identityNumber:input.identityNumber}}},include:{resident:true}});return publicUser(user);},
  async login(input:any){const user=await userRepository.byEmail(input.email);if(!user||!await bcrypt.compare(input.password,user.passwordHash))throw new AppError(401,'INVALID_CREDENTIALS','Email hoặc mật khẩu không đúng');if(user.status==='LOCKED')throw new AppError(423,'ACCOUNT_LOCKED','Tài khoản đã bị khóa');if(user.role==='RESIDENT'&&(!user.resident||user.resident.status!=='ACTIVE'))throw new AppError(403,'RESIDENT_INACTIVE','Hồ sơ cư dân chưa hoạt động');if(user.status!=='ACTIVE')throw new AppError(403,'ACCOUNT_INACTIVE','Tài khoản đã ngừng hoạt động');return{user:publicUser(user),accessToken:access(user),refreshToken:await issueRefresh(user.id)};},
  async refresh(raw:string){const tokenHash=hashToken(raw),now=new Date();const row=await prisma.refreshToken.findUnique({where:{tokenHash},include:{user:true}});if(!row||row.revokedAt||row.expiresAt<=now||row.user.status!=='ACTIVE')throw new AppError(401,'INVALID_REFRESH_TOKEN','Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi');const next=randomToken(),nextHash=hashToken(next);await prisma.$transaction(async tx=>{const claimed=await tx.refreshToken.updateMany({where:{id:row.id,revokedAt:null,expiresAt:{gt:now}},data:{revokedAt:now,replacedByHash:nextHash}});if(claimed.count!==1)throw new AppError(401,'REFRESH_TOKEN_REUSED','Refresh token đã được sử dụng hoặc thu hồi');await tx.refreshToken.create({data:{userId:row.userId,tokenHash:nextHash,expiresAt:new Date(Date.now()+env.REFRESH_TOKEN_EXPIRES_DAYS*86400000)}});});return{accessToken:access(row.user),refreshToken:next};},
  async logout(raw:string){await prisma.refreshToken.updateMany({where:{tokenHash:hashToken(raw),revokedAt:null},data:{revokedAt:new Date()}});},
  async me(id:number){const user=await userRepository.byId(id);if(!user)throw notFound('Tài khoản');return publicUser(user);}
};
