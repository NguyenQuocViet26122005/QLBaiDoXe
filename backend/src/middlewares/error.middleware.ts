import type { ErrorRequestHandler,RequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';
export const notFoundHandler:RequestHandler=(req,res)=>res.status(404).json({success:false,message:`Không tìm thấy ${req.method} ${req.originalUrl}`,errorCode:'ROUTE_NOT_FOUND',errors:[]});
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof AppError) return void res.status(error.statusCode).json({success:false,message:error.message,errorCode:error.errorCode,errors:error.errors});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002') return void res.status(409).json({success:false,message:'Dữ liệu đã tồn tại',errorCode:'DUPLICATE_DATA',errors:[]});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2003') return void res.status(409).json({success:false,message:'Không thể thay đổi dữ liệu đang được tham chiếu',errorCode:'DATA_IN_USE',errors:[]});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2025') return void res.status(404).json({success:false,message:'Dữ liệu không tồn tại',errorCode:'NOT_FOUND',errors:[]});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034') return void res.status(409).json({success:false,message:'Dữ liệu vừa được thay đổi bởi yêu cầu khác, vui lòng thử lại',errorCode:'CONCURRENT_UPDATE',errors:[]});
  logger.error({err:error},'Unhandled request error');
  res.status(500).json({success:false,message:'Lỗi máy chủ nội bộ',errorCode:'INTERNAL_SERVER_ERROR',errors:[]});
};
