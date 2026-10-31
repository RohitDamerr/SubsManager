import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth as authApi } from '../../api/resources.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', companyName: '', phone: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await authApi.register(form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Create your account</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label>Password (8+ chars, uppercase, lowercase, special)</label>
            <input type="password" value={form.password} onChange={set('password')} required />
          </div>
          <div className="form-group">
            <label>Company name</label>
            <input value={form.companyName} onChange={set('companyName')} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} />
          </div>
          <button type="submit" style={{ width: '100%' }}>Register</button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
