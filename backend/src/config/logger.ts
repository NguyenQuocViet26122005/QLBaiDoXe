import pino from 'pino';
import { env } from './env.js';
export const logger=pino({level:env.NODE_ENV==='test'?'silent':env.NODE_ENV==='production'?'info':'debug',redact:{paths:['req.headers.authorization','password','passwordHash','accessToken','refreshToken'],censor:'[REDACTED]'}});
