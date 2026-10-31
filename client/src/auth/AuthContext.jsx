// AuthContext — current user + token.  Loads /auth/me on boot, exposes login/register/logout.
// Logout (or an expired token) clears the query cache so one user's data never shows for the next.
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth as authApi } from '../api/resources.js';
import { TOKEN_KEY, AUTH_EXPIRED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    // A 401 here already cleared the session via the interceptor; other failures
    // (server restarting, network) keep the token so a reload can recover.
    authApi.me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clearSession]);

  // The axios interceptor fires this on any 401 from an authenticated call.
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clearSession);
  }, [clearSession]);

  const startSession = useCallback(({ user: u, token }) => {
    queryClient.clear();
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  }, [queryClient]);

  const login = useCallback(
    async (email, password) => startSession(await authApi.login({ email, password })),
    [startSession]
  );

  const register = useCallback(
    async (payload) => startSession(await authApi.register(payload)),
    [startSession]
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout: clearSession }),
    [user, loading, login, register, clearSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
