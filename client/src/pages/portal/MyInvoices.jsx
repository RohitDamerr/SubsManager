// Customer portal — my invoices (read + print only).
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { invoices } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function MyInvoices() {
  const { data } = useQuery({ queryKey: ['my-invoices'], queryFn: () => invoices.list({ limit: 50 }) });

  return (
    <div>
      <h1 className="page-title">My Invoices</h1>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Total</th><th>Paid</th><th></th></tr></thead>
          <tbody>
            {(data?.data || []).map((inv) => (
              <tr key={inv._id}>
                <td>{inv.number || '(draft)'}</td>
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
