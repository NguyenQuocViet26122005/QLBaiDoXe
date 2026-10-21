import type { UserRole } from '../generated/prisma/client.js';
declare global { namespace Express { interface Request { auth?:{userId:number;role:UserRole;residentId?:number}; validated?:{body?:unknown;query?:unknown;params?:unknown}; } } }
export {};
