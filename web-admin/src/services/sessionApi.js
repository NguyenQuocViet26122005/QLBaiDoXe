import http,{dataOf} from './httpClient';
export const getSessions=()=>http.get('/parking/sessions').then(dataOf);
export const manualCheckout=(id,body)=>http.post(`/parking/sessions/${id}/manual-checkout`,body).then(dataOf);
