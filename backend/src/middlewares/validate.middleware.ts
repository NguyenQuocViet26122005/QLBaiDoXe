import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';
export const validate=(schemas:{body?:ZodType;query?:ZodType;params?:ZodType}):RequestHandler=>(req,_res,next)=>{const validated:Record<string,unknown>={};for(const key of ['body','query','params'] as const){const schema=schemas[key];if(!schema)continue;const result=schema.safeParse(req[key]);if(!result.success)return next(new AppError(422,'VALIDATION_ERROR','Dữ liệu đầu vào không hợp lệ',result.error.issues));validated[key]=result.data;}req.validated=validated;next();};
