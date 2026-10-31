// Quotation templates — list + create form.  Admin and Staff.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templates, plans, products } from '../../api/resources.js';

export default function Templates() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', planId: '', validityDays: 30, lines: [] });
  const [lineDraft, setLineDraft] = useState({ productId: '', quantity: 1 });

  const { data } = useQuery({ queryKey: ['templates'], queryFn: () => templates.list({ limit: 100 }) });
  const { data: plansData } = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: () => products.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: templates.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['templates']);
      setShowForm(false);
      setForm({ name: '', planId: '', validityDays: 30, lines: [] });
    },
  });

  const addLine = () => {
    if (!lineDraft.productId) return;
    setForm({ ...form, lines: [...form.lines, lineDraft] });
    setLineDraft({ productId: '', quantity: 1 });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Quotation Templates</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Template'}</button>
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
                <label>Plan</label>
                <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} required>
                  <option value="">Select plan…</option>
                  {(plansData?.data || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col form-group">
                <label>Validity (days)</label>
                <input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) })} required />
              </div>
            </div>

            <div className="card-title">Lines</div>
            {form.lines.map((l, i) => (
              <div key={i} style={{ marginBottom: 8, fontSize: 14 }}>
                Product: {l.productId} × {l.quantity}
                <button type="button" className="secondary" style={{ marginLeft: 12, padding: '2px 8px' }}
                  onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <div className="row">
              <div className="col form-group">
                <label>Product</label>
                <select value={lineDraft.productId} onChange={(e) => setLineDraft({ ...lineDraft, productId: e.target.value })}>
                  <option value="">Select product…</option>
                  {(productsData?.data || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col form-group">
                <label>Quantity</label>
                <input type="number" min="1" value={lineDraft.quantity} onChange={(e) => setLineDraft({ ...lineDraft, quantity: parseInt(e.target.value) })} />
              </div>
              <button type="button" onClick={addLine} style={{ alignSelf: 'flex-end' }}>Add Line</button>
            </div>

            <button type="submit">Create Template</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Plan</th><th>Validity</th><th>Lines</th></tr></thead>
          <tbody>
            {(data?.data || []).map((t) => (
              <tr key={t._id}>
                <td>{t.name}</td>
                <td>{t.planId}</td>
                <td>{t.validityDays} days</td>
                <td>{t.lines?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
