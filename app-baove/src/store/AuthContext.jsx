import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import { onSessionExpired } from '../api/axiosClient';
import { ACCESS_TOKEN_KEY, MOBILE_ROLES, REFRESH_TOKEN_KEY, USER_KEY } from '../utils/constants';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const clear = async () => {
    await Promise.all([storage.deleteItemAsync(ACCESS_TOKEN_KEY), storage.deleteItemAsync(REFRESH_TOKEN_KEY), storage.deleteItemAsync(USER_KEY)]);
    setUser(null);
  };
  useEffect(() => { onSessionExpired(clear); return () => onSessionExpired(null); }, []);
  useEffect(() => { (async () => {
    try {
      const token = await storage.getItemAsync(ACCESS_TOKEN_KEY);
      if (!token) return;
      const current = await authApi.me();
      if (!MOBILE_ROLES.includes(current.role)) throw new Error('ROLE_NOT_ALLOWED');
      await storage.setItemAsync(USER_KEY, JSON.stringify(current));
      setUser(current);
    } catch { await clear(); }
    finally { setChecking(false); }
  })(); }, []);
  const login = async (email, password) => {
    const result = await authApi.login({ email: email.trim().toLowerCase(), password });
    if (!MOBILE_ROLES.includes(result.user.role)) throw new Error('Ứng dụng chỉ dành cho cư dân và bảo vệ.');
    await Promise.all([
      storage.setItemAsync(ACCESS_TOKEN_KEY, result.accessToken), storage.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken),
      storage.setItemAsync(USER_KEY, JSON.stringify(result.user))
    ]);
    setUser(result.user); return result.user;
  };
  const logout = async () => {
    try {
      const refreshToken = await storage.getItemAsync(REFRESH_TOKEN_KEY);
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Local sign-out must also work when the server is unreachable.
    } finally {
      await clear();
    }
  };
  const value = useMemo(() => ({ user, checking, login, logout, refreshUser: async () => { const next = await authApi.me(); setUser(next); return next; } }), [user, checking]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
