import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth as authApi } from '../../api/resources.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={<Link to="/login">← Back to sign in</Link>}
    >
      {sent ? (
        <div className="alert alert-success">If an account exists for {email}, a reset link is on its way. It expires in 30 minutes.</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <ErrorAlert error={error} />
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <button type="submit" className="block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}
