import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './config/logger.js';
import { startExpiryJob } from './jobs/expiry.job.js';
const server=app.listen(env.PORT,()=>{logger.info(`API chạy tại http://localhost:${env.PORT}`);logger.info(`Swagger tại http://localhost:${env.PORT}/api-docs`);startExpiryJob();});
const shutdown=async(signal:string)=>{logger.info({signal},'Đang dừng ứng dụng');server.close(async()=>{await prisma.$disconnect();process.exit(0);});};process.on('SIGINT',()=>void shutdown('SIGINT'));process.on('SIGTERM',()=>void shutdown('SIGTERM'));
