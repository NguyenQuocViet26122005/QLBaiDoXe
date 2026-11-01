import http,{dataOf} from './httpClient';
export const getNotifications=()=>http.get('/notifications').then(dataOf);export const markRead=(id)=>http.patch(`/notifications/${id}/read`).then(dataOf);export const markAllRead=()=>http.patch('/notifications/read-all').then(dataOf);
