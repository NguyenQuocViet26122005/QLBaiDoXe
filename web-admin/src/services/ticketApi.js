import http,{dataOf} from './httpClient';
export const getTickets=()=>http.get('/tickets').then(dataOf);export const getTicket=(id)=>http.get(`/tickets/${id}`).then(dataOf);export const getTicketQr=(id)=>http.get(`/tickets/${id}/qr`).then(dataOf);export const lockTicket=(id,reason)=>http.patch(`/tickets/${id}/lock`,{reason}).then(dataOf);export const unlockTicket=(id)=>http.patch(`/tickets/${id}/unlock`).then(dataOf);export const cancelTicket=(id)=>http.patch(`/tickets/${id}/cancel`).then(dataOf);
export const regenerateQr=(id)=>http.post(`/tickets/${id}/regenerate-qr`).then(dataOf);
