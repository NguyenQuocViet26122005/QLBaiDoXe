import http,{dataOf} from './httpClient';
export const getUsers=()=>http.get('/users').then(dataOf);export const updateUser=(id,body)=>http.patch(`/users/${id}`,body).then(dataOf);
