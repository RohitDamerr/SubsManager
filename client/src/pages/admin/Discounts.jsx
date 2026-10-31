// Discounts — CRUD for discount rules.  Admin only.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discounts } from '../../api/resources.js';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function Discounts() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'PERCENT', value: 0, scope: 'SUBSCRIPTION', productIds: [],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    usageLimit: null, minPurchase: undefined, minQuantity: undefined,
  });

  const { data } = useQuery({ queryKey: ['discounts'], queryFn: () => discounts.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: discounts.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['discounts']);
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      value: form.type === 'PERCENT' ? form.value : Math.round(form.value * 100),
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      minPurchase: form.minPurchase ? Math.round(form.minPurchase * 100) : undefined,
    };
    createMutation.mutate(payload);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Discounts</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Discount'}</button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col form-group">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </div>
              <div className="col form-group">
                <label>Value ({form.type === 'PERCENT' ? '%' : '₹'})</label>
                <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) })} required />
              </div>
            </div>
            <div className="row">
              <div className="col form-group">
                <label>Scope</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="PRODUCT">Product</option>
                </select>
              </div>
              <div className="col form-group">
                <label>Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div className="col form-group">
                <label>End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="row">
              <div className="col form-group">
                <label>Usage Limit (blank = unlimited)</label>
                <input type="number" value={form.usageLimit || ''} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              </div>
              <div className="col form-group">
                <label>Min Purchase (₹, optional)</label>
                <input type="number" step="0.01" value={form.minPurchase || ''} onChange={(e) => setForm({ ...form, minPurchase: parseFloat(e.target.value) })} />
              </div>
            </div>
            <button type="submit">Create Discount</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Scope</th><th>Usage</th><th>Active</th></tr></thead>
          <tbody>
            {(data?.data || []).map((d) => (
              <tr key={d._id}>
                <td>{d.name}</td>
                <td>{d.type}</td>
                <td>{d.type === 'PERCENT' ? `${d.value}%` : <MoneyText amount={d.value} />}</td>
                <td>{d.scope}</td>
                <td>{d.usedCount || 0}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                <td>{d.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
