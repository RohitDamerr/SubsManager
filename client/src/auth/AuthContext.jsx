// AuthContext — stores user + token, exposes login/logout, loads current user on mount.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi } from '../api/resources.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current user on mount if a token exists.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((u) => setUser(u))
      .catch(() => { localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user, token } = await authApi.login({ email, password });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = { user, loading, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
