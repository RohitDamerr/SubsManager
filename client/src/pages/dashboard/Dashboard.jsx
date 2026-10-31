// Dashboard — KPI cards from the summary endpoint + overdue list.
import { useQuery } from '@tanstack/react-query';
import { reports } from '../../api/resources.js';
import { MoneyText } from '../../components/MoneyText.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';

  const { data: summary } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: reports.summary,
    enabled: !isCustomer,
  });

  const { data: overdue } = useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: () => reports.overdue({ limit: 10 }),
    enabled: !isCustomer,
  });

  if (isCustomer) {
    return (
      <div>
        <h1 className="page-title">Welcome, {user?.name}</h1>
        <div className="card">
          <div className="card-title">Your subscriptions</div>
          <p>Visit "My Subscriptions" and "My Invoices" to manage your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Finance Dashboard</h1>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Active Subscriptions</div>
          <div className="kpi-value">{summary?.activeSubscriptions ?? '—'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MRR (Monthly Recurring Revenue)</div>
          <div className="kpi-value"><MoneyText amount={summary?.mrr} /></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value"><MoneyText amount={summary?.outstanding} /></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Overdue Invoices</div>
          <div className="kpi-value">{summary?.overdueCount ?? '—'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Overdue Invoices</div>
        {overdue && overdue.length > 0 ? (
          <table>
            <thead>
              <tr><th>Number</th><th>Customer</th><th>Due Date</th><th>Days Late</th><th>Outstanding</th></tr>
            </thead>
            <tbody>
              {overdue.map((inv) => (
                <tr key={inv._id}>
                  <td>{inv.number}</td>
                  <td>{inv.customerName || '—'}</td>
                  <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td><span className="badge badge-overdue">{inv.daysLate}d</span></td>
                  <td><MoneyText amount={(inv.total || 0) - (inv.amountPaid || 0)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No overdue invoices</div>
        )}
      </div>
    </div>
  );
}
