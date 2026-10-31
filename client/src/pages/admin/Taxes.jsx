// Taxes — CRUD.  Admin only.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxes } from '../../api/resources.js';

export default function Taxes() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', ratePercent: 0, isInclusive: false });

  const { data } = useQuery({ queryKey: ['taxes'], queryFn: () => taxes.list() });

  const createMutation = useMutation({
    mutationFn: taxes.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['taxes']);
      setShowForm(false);
      setForm({ name: '', ratePercent: 0, isInclusive: false });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Taxes</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Tax'}</button>
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
                <label>Rate (%)</label>
                <input type="number" step="0.01" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: parseFloat(e.target.value) })} required />
              </div>
              <div className="col form-group">
                <label>Inclusive?</label>
                <select value={form.isInclusive} onChange={(e) => setForm({ ...form, isInclusive: e.target.value === 'true' })}>
                  <option value="false">Exclusive</option>
                  <option value="true">Inclusive</option>
                </select>
              </div>
            </div>
            <button type="submit">Create Tax</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Rate</th><th>Style</th><th>Active</th></tr></thead>
          <tbody>
            {(data?.data || []).map((t) => (
              <tr key={t._id}>
                <td>{t.name}</td>
                <td>{t.ratePercent}%</td>
                <td>{t.isInclusive ? 'Inclusive' : 'Exclusive'}</td>
                <td>{t.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
