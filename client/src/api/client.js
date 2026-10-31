// Axios instance with JWT bearer token.  A 401 on an authenticated call means the
// session is gone: we drop the token and tell AuthContext, which routes to /login.
import axios from 'axios';

export const TOKEN_KEY = 'token';
export const AUTH_EXPIRED_EVENT = 'auth:expired';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Login/register return 401/400 for bad credentials — those are form errors, not expiry.
const PUBLIC_AUTH = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !PUBLIC_AUTH.some((p) => url.startsWith(p))) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from an API error, including zod field details. */
export function errorMessage(err, fallback = 'Something went wrong') {
  const e = err?.response?.data?.error;
  if (!e) return err?.message === 'Network Error' ? 'Cannot reach the server' : fallback;
  if (Array.isArray(e.details) && e.details.length) {
    return `${e.message}: ${e.details.map((d) => (d.path ? `${d.path} — ${d.message}` : d.message)).join('; ')}`;
  }
  return e.message || fallback;
}

export default api;
