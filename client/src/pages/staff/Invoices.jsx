// Invoices list — filterable by status, overdue.  Staff and Admin.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { invoices } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function Invoices() {
  const [status, setStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ['invoices', status, overdueOnly],
    queryFn: () => invoices.list({
      limit: 50,
      ...(status ? { status } : {}),
      ...(overdueOnly ? { overdue: 'true' } : {}),
    }),
  });

  return (
    <div>
      <h1 className="page-title">Invoices</h1>

      <div className="card">
        <div className="row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="col form-group" style={{ maxWidth: 200 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
            </label>
          </div>
        </div>

        <table>
          <thead><tr><th>Number</th><th>Customer</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Total</th><th>Paid</th><th></th></tr></thead>
          <tbody>
            {(data?.data || []).map((inv) => (
              <tr key={inv._id}>
                <td>{inv.number || '(draft)'}</td>
                <td>{inv.customerName || '—'}</td>
                <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td><StatusBadge status={inv.status} /></td>
                <td><MoneyText amount={inv.total} /></td>
                <td><MoneyText amount={inv.amountPaid} /></td>
                <td><Link to={`/invoices/${inv._id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
