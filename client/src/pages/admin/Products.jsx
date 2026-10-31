// Products — CRUD with embedded variants.  Admin only.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { products } from '../../api/resources.js';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function Products() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'SERVICE', salesPrice: 0, taxIds: [] });

  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => products.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: products.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      setShowForm(false);
      setForm({ name: '', type: 'SERVICE', salesPrice: 0, taxIds: [] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, salesPrice: Math.round(form.salesPrice * 100) });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Products</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Product'}</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Product</div>
          {createMutation.isError && <div className="error-message">{createMutation.error.response?.data?.error?.message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col form-group">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="SERVICE">Service</option>
                  <option value="GOOD">Good</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Sales Price (₹)</label>
              <input type="number" step="0.01" value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: parseFloat(e.target.value) })} required />
            </div>
            <button type="submit">Create Product</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Type</th><th>Price</th><th>Variants</th><th>Active</th></tr>
          </thead>
          <tbody>
            {(data?.data || []).map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td><MoneyText amount={p.salesPrice} /></td>
                <td>{p.variants?.length || 0}</td>
                <td>{p.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
