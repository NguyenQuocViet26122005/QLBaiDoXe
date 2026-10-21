import type { Response } from 'express';
export const ok=(res:Response,data:unknown,message='Thành công',status=200)=>res.status(status).json({success:true,message,data});
