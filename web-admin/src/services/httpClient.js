import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
export const tokenStore = {
  access: () => localStorage.getItem('parking_access_token'),
  refresh: () => localStorage.getItem('parking_refresh_token'),
  save: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem('parking_access_token', accessToken);
    if (refreshToken) localStorage.setItem('parking_refresh_token', refreshToken);
  },
  clear: () => {
    localStorage.removeItem('parking_access_token');
    localStorage.removeItem('parking_refresh_token');
    localStorage.removeItem('parking_user');
  }
};

const http = axios.create({ baseURL: API_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });
let refreshPromise = null;

http.interceptors.request.use((config) => {
  const token = tokenStore.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const canRefresh = error.response?.status === 401 && !original?._retried && tokenStore.refresh() && !original?.url?.includes('/auth/refresh');
    if (canRefresh) {
      original._retried = true;
      try {
        refreshPromise ||= axios.post(`${API_URL}/auth/refresh`, { refreshToken: tokenStore.refresh() }).then((response) => response.data.data).finally(() => { refreshPromise = null; });
        const tokens = await refreshPromise;
        tokenStore.save(tokens);
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return http(original);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event('parking:session-expired'));
      }
    }
    const status = error.response?.status;
    const defaults = { 400: 'Yêu cầu không hợp lệ.', 401: 'Phiên đăng nhập đã hết hạn.', 403: 'Bạn không có quyền thực hiện chức năng này.', 404: 'Không tìm thấy dữ liệu.', 409: 'Dữ liệu đã tồn tại hoặc đang xung đột.', 422: 'Vui lòng kiểm tra lại dữ liệu đã nhập.', 500: 'Có lỗi xảy ra từ máy chủ.' };
    const normalized = new Error(error.response?.data?.message || defaults[status] || 'Không thể kết nối đến máy chủ.');
    normalized.status = status;
    normalized.code = error.response?.data?.errorCode;
    normalized.errors = error.response?.data?.errors || [];
    return Promise.reject(normalized);
  }
);

export const dataOf = (response) => response?.data;
export default http;
