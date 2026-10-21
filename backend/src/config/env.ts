import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'), PORT:z.coerce.number().int().positive().default(4000),
  DB_HOST:z.string().default('localhost'), DB_PORT:z.coerce.number().int().positive().default(3306), DB_USER:z.string().min(1), DB_PASSWORD:z.string(), DB_NAME:z.string().min(1),
  JWT_ACCESS_SECRET:z.string().min(32), JWT_REFRESH_SECRET:z.string().min(32), ACCESS_TOKEN_EXPIRES_IN:z.string().default('15m'), REFRESH_TOKEN_EXPIRES_DAYS:z.coerce.number().positive().default(7),
  CORS_ORIGINS:z.string().default('http://localhost:5173'), SMTP_HOST:z.string().optional(), SMTP_PORT:z.coerce.number().default(587), SMTP_USER:z.string().optional(), SMTP_PASSWORD:z.string().optional(), MAIL_FROM:z.string().email().default('parking@example.com'), CRON_ENABLED:z.string().default('true').transform(v=>v==='true')
});
const parsed=schema.safeParse(process.env);
if(!parsed.success) throw new Error(`Cấu hình môi trường không hợp lệ: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
export const env=parsed.data;
