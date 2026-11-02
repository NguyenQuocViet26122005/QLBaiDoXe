import http,{dataOf} from './httpClient';
export const getDashboard=()=>http.get('/reports/dashboard').then(dataOf);export const getRevenue=()=>http.get('/reports/revenue').then(dataOf);export const getParking=()=>http.get('/reports/parking').then(dataOf);export const getViolationReport=()=>http.get('/reports/violations').then(dataOf);
