export class AppError extends Error { constructor(public statusCode:number,public errorCode:string,message:string,public errors:unknown[]=[]){super(message);} }
export const notFound=(name='Dữ liệu')=>new AppError(404,'NOT_FOUND',`${name} không tồn tại`);
export const forbidden=()=>new AppError(403,'FORBIDDEN','Bạn không có quyền thực hiện thao tác này');
