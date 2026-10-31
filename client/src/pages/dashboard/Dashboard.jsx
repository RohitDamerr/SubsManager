// Finance dashboard — Admin & Staff.  One summary call for the KPI cards (server runs the
// aggregations in parallel), a 12-month revenue series, and the overdue list.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reports, billing } from '../../api/resources.js';
import { errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { MoneyText } from '../../components/MoneyText.jsx';
import { BarChart } from '../../components/BarChart.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Card, Empty, ErrorAlert, PageHeader, QueryState, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';

function last12Months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return {
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const months = useMemo(last12Months, []);

  const summary = useQuery({ queryKey: ['reports', 'summary'], queryFn: reports.summary });
  const revenue = useQuery({
    queryKey: ['reports', 'revenue', months[0].period],
    queryFn: () => reports.revenue({ from: `${months[0].period}-01`, groupBy: 'month' }),
  });
  const overdue = useQuery({ queryKey: ['reports', 'overdue'], queryFn: () => reports.overdue({ limit: 10 }) });

  const runBilling = useMutation({
    mutationFn: billing.run,
    onSuccess: (r) => {
      toast(r.ran ? `Billing run complete — ${r.created} invoice(s) created${r.errors ? `, ${r.errors} failed` : ''}` : r.reason);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err) => toast(errorMessage(err, 'Billing run failed'), 'error'),
  });

  const series = useMemo(() => {
    const byPeriod = new Map((revenue.data?.series || []).map((s) => [s.period, s.total]));
    return months.map((m) => ({ ...m, total: byPeriod.get(m.period) || 0 }));
  }, [revenue.data, months]);

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Finance dashboard"
        subtitle={`Welcome back, ${user.name}`}
        actions={can(user, 'billing:run') && (
          <button onClick={() => runBilling.mutate()} disabled={runBilling.isPending}>
            {runBilling.isPending ? 'Running…' : '↻ Run billing now'}
          </button>
        )}
      />

      {summary.isError ? <ErrorAlert error={summary.error} fallback="Failed to load summary" /> : (
        <div className="kpi-grid">
          <Kpi label="Active subscriptions" value={s ? s.activeSubscriptions : null} />
          <Kpi label="Monthly recurring revenue" value={s && formatMoney(s.mrr)} hint="Sum of active subscriptions, per month" />
          <Kpi label="Received this month" value={s && formatMoney(s.revenueThisMonth)} />
          <Kpi label="Outstanding" value={s && formatMoney(s.outstanding)} hint="Confirmed invoices not yet paid" />
          <Kpi label="Overdue invoices" value={s ? s.overdueCount : null} alert={s?.overdueCount > 0} />
        </div>
      )}

      <div className="grid-2">
        <Card title="Revenue received — last 12 months" actions={revenue.data && <span className="muted">Total {formatMoney(revenue.data.total)}</span>}>
          {revenue.isLoading ? <Spinner /> : revenue.isError ? <ErrorAlert error={revenue.error} /> : <BarChart series={series} />}
        </Card>

        <Card title="Quick links">
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="secondary" onClick={() => navigate('/subscriptions')}>Subscriptions</button>
            <button className="secondary" onClick={() => navigate('/invoices?status=DRAFT')}>Draft invoices to confirm</button>
            <button className="secondary" onClick={() => navigate('/invoices?overdue=true')}>Overdue invoices</button>
          </div>
        </Card>
      </div>

      <Card title="Overdue invoices" bodyless>
        <QueryState query={overdue} isEmpty={!overdue.data?.length} empty={<Empty title="No overdue invoices">Everything confirmed is within its due date.</Empty>}>
          <DataTable
            data={overdue.data || []}
            onRowClick={(inv) => navigate(`/invoices/${inv._id}`)}
            columns={[
              { key: 'number', label: 'Invoice', render: (inv) => <span className="strong">{inv.number}</span> },
              { key: 'customerName', label: 'Customer', render: (inv) => inv.customerName || '—' },
              { key: 'dueDate', label: 'Due', render: (inv) => formatDate(inv.dueDate) },
              { key: 'daysLate', label: 'Late', render: (inv) => <span className="badge badge-red">{inv.daysLate} days</span> },
              { key: 'owed', label: 'Owed', align: 'right', render: (inv) => <MoneyText amount={(inv.total || 0) - (inv.amountPaid || 0)} /> },
            ]}
          />
        </QueryState>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint, alert }) {
  return (
    <div className={`kpi-card ${alert ? 'alert' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? <span className="muted">…</span>}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}
