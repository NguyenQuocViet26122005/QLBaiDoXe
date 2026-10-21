export const ACTIVE_TICKET_KEY=(vehicleId:number)=>`ACTIVE:${vehicleId}`;
export const OPEN_SESSION_KEY=(vehicleId:number)=>`PARKING:${vehicleId}`;
export const OPEN_REGISTRATION_KEY=(vehicleId:number)=>`OPEN:${vehicleId}`;
export const STAFF_ROLES=['MANAGER','ADMIN'] as const;
