// Layout — sidebar navigation generated from the user's role.
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/plans', label: 'Plans' },
    { to: '/taxes', label: 'Taxes' },
    { to: '/discounts', label: 'Discounts' },
    { to: '/templates', label: 'Templates' },
    { to: '/subscriptions', label: 'Subscriptions' },
    { to: '/invoices', label: 'Invoices' },
    { to: '/staff', label: 'Staff' },
  ],
  STAFF: [
    { to: '/', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/templates', label: 'Templates' },
    { to: '/subscriptions', label: 'Subscriptions' },
    { to: '/invoices', label: 'Invoices' },
  ],
  CUSTOMER: [
    { to: '/', label: 'Dashboard' },
    { to: '/my-subscriptions', label: 'My Subscriptions' },
    { to: '/my-invoices', label: 'My Invoices' },
  ],
};

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV_BY_ROLE[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Brightloop</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '20px', marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{user?.email} ({user?.role})</div>
          <button className="secondary" onClick={handleLogout} style={{ width: '100%' }}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
