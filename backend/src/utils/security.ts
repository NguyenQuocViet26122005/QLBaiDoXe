import { createHash,randomBytes } from 'node:crypto';
export const randomToken=(bytes=48)=>randomBytes(bytes).toString('base64url');
export const hashToken=(value:string)=>createHash('sha256').update(value).digest('hex');
export const normalizePlate=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9]/g,'').replace(/^([0-9]{2}[A-Z]{1,2})([0-9]{4,5})$/,'$1-$2');
export const code=(prefix:string)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
