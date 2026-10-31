// Route guards.
//  RequireAuth  — not signed in → /login (remembering where you were); wrong role → 403 page.
//  PublicOnly   — signed-in users visiting /login or /register go to their home instead.
//  RoleHome     — "/" sends each role to its landing page.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { hasRole, homeFor } from './roles.js';
import { Forbidden } from '../pages/Forbidden.jsx';

function FullScreenLoader() {
  return <div className="center-screen"><div className="spinner" /></div>;
}

export function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!hasRole(user, roles)) return <Forbidden />;
  return <Outlet />;
}

export function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

export function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}
