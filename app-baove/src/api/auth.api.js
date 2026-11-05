import axios from './axiosClient';
export const authApi = {
  login: (payload) => axios.post('/auth/login', payload),
  me: () => axios.get('/auth/me'),
  logout: (refreshToken) => axios.post('/auth/logout', { refreshToken }, { timeout: 3000 })
};
