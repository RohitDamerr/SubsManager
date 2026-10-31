// 403 / 404 screens.  Shown inside the layout when a role opens a page it may not use.
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homeFor } from '../auth/roles.js';

function Message({ code, title, text }) {
  const { user } = useAuth();
  return (
    <div className="center-screen" style={{ minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--border-strong)' }}>{code}</div>
        <h2 style={{ marginBottom: 6, color: 'var(--text)' }}>{title}</h2>
        <p style={{ marginBottom: 18 }}>{text}</p>
        <Link className="btn" to={user ? homeFor(user.role) : '/login'}>Go to my home</Link>
      </div>
    </div>
  );
}

export function Forbidden() {
  return <Message code="403" title="You don't have access to this page" text="Your role doesn't include this area. Ask an admin if you need it." />;
}

export function NotFound() {
  return <Message code="404" title="Page not found" text="The page you're looking for doesn't exist." />;
}
