// Subscriptions list — Staff and Admin.  Create with template or lines.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { subscriptions, plans, templates } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: '', planId: '', templateId: '', startDate: new Date().toISOString().slice(0, 10) });

  const { data } = useQuery({ queryKey: ['subscriptions'], queryFn: () => subscriptions.list({ limit: 50 }) });
  const { data: plansData } = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });
  const { data: templatesData } = useQuery({ queryKey: ['templates'], queryFn: () => templates.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: subscriptions.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['subscriptions']);
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      customerId: form.customerId,
      planId: form.planId,
      startDate: new Date(form.startDate),
      ...(form.templateId ? { templateId: form.templateId } : {}),
    };
    createMutation.mutate(payload);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Subscriptions</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Subscription'}</button>
      </div>

      {showForm && (
        <div className="card">
          {createMutation.isError && <div className="error-message">{createMutation.error.response?.data?.error?.message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col form-group">
                <label>Customer ID</label>
                <input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
              </div>
              <div className="col form-group">
                <label>Plan</label>
                <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} required>
                  <option value="">Select plan…</option>
                  {(plansData?.data || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="col form-group">
                <label>Template (optional)</label>
                <select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
                  <option value="">None — manual lines</option>
                  {(templatesData?.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col form-group">
                <label>Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
            </div>
            <button type="submit">Create Subscription</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Plan</th><th>Status</th><th>Monthly</th><th>Next Invoice</th><th></th></tr></thead>
          <tbody>
            {(data?.data || []).map((s) => (
              <tr key={s._id}>
                <td>{s.number}</td>
                <td>{s.planName || '—'}</td>
                <td><StatusBadge status={s.status} /></td>
                <td><MoneyText amount={s.monthlyAmount} /></td>
                <td>{s.nextInvoiceDate ? new Date(s.nextInvoiceDate).toLocaleDateString() : '—'}</td>
                <td><Link to={`/subscriptions/${s._id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
