// Plans — CRUD.  Admin only.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plans } from '../../api/resources.js';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function Plans() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', price: 0, billingPeriod: 'MONTHLY', minQuantity: 0, autoClose: false, allowEarlyClose: true, allowPause: true, allowRenew: true });

  const { data } = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: plans.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['plans']);
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, price: Math.round(form.price * 100) });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Plans</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Plan'}</button>
      </div>

      {showForm && (
        <div className="card">
          {createMutation.isError && <div className="error-message">{createMutation.error.response?.data?.error?.message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col form-group">
                <label>Price (₹)</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} required />
              </div>
            </div>
            <div className="row">
              <div className="col form-group">
                <label>Billing Period</label>
                <select value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="col form-group">
                <label>Min Quantity</label>
                <input type="number" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="row">
              <label><input type="checkbox" checked={form.autoClose} onChange={(e) => setForm({ ...form, autoClose: e.target.checked })} /> Auto Close</label>
              <label><input type="checkbox" checked={form.allowPause} onChange={(e) => setForm({ ...form, allowPause: e.target.checked })} /> Allow Pause</label>
              <label><input type="checkbox" checked={form.allowEarlyClose} onChange={(e) => setForm({ ...form, allowEarlyClose: e.target.checked })} /> Allow Early Close</label>
            </div>
            <button type="submit">Create Plan</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Price</th><th>Period</th><th>Min Qty</th><th>Flags</th></tr></thead>
          <tbody>
            {(data?.data || []).map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td><MoneyText amount={p.price} /></td>
                <td>{p.billingPeriod}</td>
                <td>{p.minQuantity || 0}</td>
                <td>{[p.autoClose && 'autoClose', p.allowPause && 'pause', p.allowEarlyClose && 'earlyClose'].filter(Boolean).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
