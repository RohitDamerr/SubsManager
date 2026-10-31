import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth as authApi } from '../../api/resources.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await authApi.forgotPassword({ email });
    setSent(true);
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Reset your password</h2>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <p>If an account exists for that email, a reset link has been sent.</p>
            <Link to="/login">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" style={{ width: '100%' }}>Send reset link</button>
          </form>
        )}
      </div>
    </div>
  );
}
