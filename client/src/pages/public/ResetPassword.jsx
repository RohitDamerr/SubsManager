import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth as authApi } from '../../api/resources.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await authApi.resetPassword({ token, password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Reset failed');
    }
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Set a new password</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reset token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" style={{ width: '100%' }}>Reset password</button>
        </form>
      </div>
    </div>
  );
}
