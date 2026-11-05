import axios from 'axios';
import { ACCESS_TOKEN_KEY, API_URL, REFRESH_TOKEN_KEY, USER_KEY } from '../utils/constants';
import { storage } from '../utils/storage';

const client = axios.create({ baseURL: API_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });
let refreshPromise = null;
let sessionExpiredHandler = null;
export const onSessionExpired = (handler) => { sessionExpiredHandler = handler; };

const clearSession = async () => Promise.all([
  storage.deleteItemAsync(ACCESS_TOKEN_KEY), storage.deleteItemAsync(REFRESH_TOKEN_KEY), storage.deleteItemAsync(USER_KEY)
]);

client.interceptors.request.use(async (config) => {
  const token = await storage.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response.data?.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry && !String(original?.url).includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise ||= (async () => {
          const refreshToken = await storage.getItemAsync(REFRESH_TOKEN_KEY);
          if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const tokens = response.data.data;
          await Promise.all([
            storage.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
            storage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken)
          ]);
          return tokens.accessToken;
        })().finally(() => { refreshPromise = null; });
        original.headers.Authorization = `Bearer ${await refreshPromise}`;
        return client(original);
      } catch {
        await clearSession();
        sessionExpiredHandler?.();
      }
    }
    const payload = error.response?.data;
    const networkCode = error.code === 'ECONNABORTED' ? 'API_TIMEOUT' : (!error.response ? 'NETWORK_ERROR' : undefined);
    const normalized = new Error(payload?.message || (networkCode === 'API_TIMEOUT' ? 'Máy chủ phản hồi quá lâu. Chưa thể xác định vé hợp lệ hay không.' : 'Mất kết nối đến máy chủ. Chưa thể xác định vé hợp lệ hay không.'));
    normalized.status = error.response?.status;
    normalized.code = payload?.errorCode || payload?.code || networkCode;
    normalized.isNetwork = Boolean(networkCode);
    normalized.details = payload?.details;
    return Promise.reject(normalized);
  }
);

export default client;
