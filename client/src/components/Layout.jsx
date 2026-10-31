// Layout — sidebar navigation generated from the user's role, page content via <Outlet />.
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navFor, ROLE_LABEL } from '../auth/roles.js';
import { initials } from '../lib/format.js';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand"><span className="brand-mark">b</span>Brightloop</div>
        <nav>
          {navFor(user.role).map((item) =>
            item.section ? (
              <div key={item.section} className="nav-section">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials(user.name)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user.email}>{user.name}</div>
            <div className="sidebar-user-role">{ROLE_LABEL[user.role]}</div>
          </div>
          <button className="ghost sm" title="Account" onClick={() => navigate('/account')}>⚙</button>
          <button className="ghost sm" title="Log out" onClick={handleLogout}>⏻</button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar-mobile">
          <button className="secondary sm" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <strong>Brightloop</strong>
        </div>
        <main className="main"><Outlet /></main>
      </div>
    </div>
  );
}
