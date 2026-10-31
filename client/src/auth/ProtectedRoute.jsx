// ProtectedRoute — guards routes by role.  Redirects to login if not authenticated.
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
