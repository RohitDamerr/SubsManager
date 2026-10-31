import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    }
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Sign in to Brightloop</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" style={{ width: '100%' }}>Sign in</button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          <Link to="/forgot-password">Forgot password?</Link> · <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
