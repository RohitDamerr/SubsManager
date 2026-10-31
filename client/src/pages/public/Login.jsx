import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canAccessPath, homeFor } from '../../auth/roles.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import { AuthShell } from './AuthShell.jsx';

// Seeded accounts (db/seed.js) — shown in dev builds only.
const DEMO = [
  ['Admin', 'admin@brightloop.com', 'Admin@123'],
  ['Staff', 'staff@brightloop.com', 'Staff@123'],
  ['Customer', 'customer@brightloop.com', 'Customer@123'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      // Return to the page that sent us here — but only if this role may open it.
      const from = location.state?.from?.pathname;
      navigate(from && canAccessPath(user.role, from) ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Brightloop account"
      footer={<>New customer? <Link to="/register">Create an account</Link></>}
    >
      {location.state?.reset && !error && <div className="alert alert-success">Password updated. Sign in with your new password.</div>}
      <ErrorAlert error={error} fallback="Login failed" />
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label={<span style={{ display: 'flex', justifyContent: 'space-between' }}>Password <Link to="/forgot-password" style={{ fontWeight: 400 }}>Forgot?</Link></span>}>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>

      {import.meta.env.DEV && (
        <div className="demo-logins">
          Demo accounts (from <span className="mono">npm run seed</span>):
          <div>
            {DEMO.map(([label, e, p]) => (
              <button key={e} type="button" className="secondary sm" onClick={() => { setEmail(e); setPassword(p); }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
