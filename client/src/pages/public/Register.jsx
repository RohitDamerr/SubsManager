// Customer self-signup.  Registration returns a token, so the user lands straight in the portal.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { homeFor } from '../../auth/roles.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import { AuthShell } from './AuthShell.jsx';

// Mirrors server PasswordPolicy so users see problems before submitting.
const RULES = [
  [(p) => p.length > 8, 'More than 8 characters'],
  [(p) => /[A-Z]/.test(p), 'An uppercase letter'],
  [(p) => /[a-z]/.test(p), 'A lowercase letter'],
  [(p) => /[^A-Za-z0-9\s]/.test(p), 'A special character'],
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', phone: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const passwordOk = RULES.every(([test]) => test(form.password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordOk) { setError('Password does not meet the requirements below'); return; }
    setError(null);
    setBusy(true);
    // Optional fields are omitted when blank (the API rejects empty strings for them).
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
    try {
      const user = await register(payload);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Customers can view subscriptions, invoices and payments."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <ErrorAlert error={error} fallback="Registration failed" />
      <form onSubmit={handleSubmit}>
        <Field label="Full name"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email"><input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Password">
          <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          {form.password && (
            <ul style={{ listStyle: 'none', marginTop: 6, fontSize: 12 }}>
              {RULES.map(([test, label]) => (
                <li key={label} style={{ color: test(form.password) ? 'var(--success)' : 'var(--text-muted)' }}>
                  {test(form.password) ? '✓' : '○'} {label}
                </li>
              ))}
            </ul>
          )}
        </Field>
        <div className="form-grid">
          <Field label="Company (optional)"><input value={form.companyName} onChange={set('companyName')} /></Field>
          <Field label="Phone (optional)"><input value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
