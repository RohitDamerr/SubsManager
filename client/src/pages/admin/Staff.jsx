// Staff — admin creates staff accounts.  Admin only.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { auth as authApi } from '../../api/resources.js';

export default function Staff() {
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'STAFF' });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: authApi.createStaff,
    onSuccess: () => {
      setSuccess('Staff account created');
      setError('');
      setForm({ email: '', name: '', password: '', role: 'STAFF' });
    },
    onError: (err) => {
      setError(err.response?.data?.error?.message || 'Failed to create staff');
      setSuccess('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div>
      <h1 className="page-title">Staff Management</h1>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-title">Create Staff Account</div>
        {success && <div style={{ color: 'var(--success)', marginBottom: 12 }}>{success}</div>}
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Staff Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
