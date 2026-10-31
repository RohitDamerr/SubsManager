import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth as authApi } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword({ token, password });
      if (user) logout(); // a different account may be signed in on this browser
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Set a new password" footer={<Link to="/login">← Back to sign in</Link>}>
      <ErrorAlert error={error} fallback="Reset failed" />
      <form onSubmit={handleSubmit}>
        {!params.get('token') && (
          <Field label="Reset token" hint="Paste the token from the email link.">
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </Field>
        )}
        <Field label="New password" hint="More than 8 characters, with upper and lower case letters and a special character.">
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Field>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
      </form>
    </AuthShell>
  );
}
