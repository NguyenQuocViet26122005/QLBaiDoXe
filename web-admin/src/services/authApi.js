import http, { dataOf } from './httpClient';
export const login = (credentials) => http.post('/auth/login', credentials).then(dataOf);
export const me = () => http.get('/auth/me').then(dataOf);
export const logout = (refreshToken) => http.post('/auth/logout', { refreshToken }).then(dataOf);
