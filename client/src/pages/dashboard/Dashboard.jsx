// Finance dashboard — Admin & Staff.  One summary call for the KPI cards (server runs the
// aggregations in parallel), a 12-month revenue series, and the overdue list.
import { useMemo, useState } from 'react';
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
import { DateRange } from '../../components/DateRange.jsx';
import { METHOD_LABEL } from '../staff/Payments.jsx';
import { dateInput, formatDate, formatMoney } from '../../lib/format.js';

const pad = (n) => String(n).padStart(2, '0');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Chart buckets for a range: days when it spans ≤ 62 days, months otherwise (matches the API's groupBy). */
function buckets(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if ((end - start) / DAY_MS <= 62) {
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push({ period: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: String(d.getDate()) });
    }
    return { groupBy: 'day', items: out };
  }
  const out = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    out.push({ period: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString('en-IN', { month: 'short' }) });
  }
  return { groupBy: 'month', items: out };
}

const RANGE_PRESETS = [['month', 'This month'], ['lastMonth', 'Last month'], ['quarter', 'This quarter'], ['year', 'This year']];

function last12Months() {
  const now = new Date();
  return { from: dateInput(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: dateInput(now) };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [range, setRange] = useState(last12Months);
  // An open-ended range (cleared dates) falls back to the last 12 months.
  const effective = { from: range.from || last12Months().from, to: range.to || dateInput(new Date()) };
  const chart = useMemo(() => buckets(effective.from, effective.to), [effective.from, effective.to]);

  const summary = useQuery({ queryKey: ['reports', 'summary'], queryFn: reports.summary });
  const revenue = useQuery({
    queryKey: ['reports', 'revenue', effective.from, effective.to, chart.groupBy],
    queryFn: () => reports.revenue({ from: effective.from, to: effective.to, groupBy: chart.groupBy }),
    placeholderData: (prev) => prev,
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
    return chart.items.map((m) => ({ ...m, total: byPeriod.get(m.period) || 0 }));
  }, [revenue.data, chart]);

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

      <Card
        title="Revenue received"
        actions={<DateRange value={range} onChange={setRange} presets={[['12m', 'Last 12 months'], ...RANGE_PRESETS]} />}
        bodyless
      >
        <div className="grid-2" style={{ padding: 18, marginBottom: 0 }}>
          <div>
            <div className="kpi-label">{formatDate(effective.from)} – {formatDate(effective.to)}</div>
            <div className="kpi-value" style={{ marginBottom: 8 }}>{revenue.data ? formatMoney(revenue.data.total) : '…'}</div>
            {revenue.isLoading ? <Spinner /> : revenue.isError ? <ErrorAlert error={revenue.error} /> : <BarChart series={series} />}
          </div>
          <div>
            <div className="kpi-label" style={{ marginBottom: 8 }}>By payment method</div>
            {revenue.data?.byMethod?.length ? (
              <table>
                <tbody>
                  {revenue.data.byMethod.map((m) => (
                    <tr key={m.method}>
                      <td>{METHOD_LABEL[m.method] || m.method}<div className="subtle">{m.count} payment(s)</div></td>
                      <td className="num strong">{formatMoney(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="muted">No payments in this range.</div>}
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={() => navigate('/payments')}>All payments</button>
              <button className="secondary" onClick={() => navigate('/invoices?status=DRAFT')}>Draft invoices to confirm</button>
              <button className="secondary" onClick={() => navigate('/invoices?overdue=true')}>Overdue invoices</button>
            </div>
          </div>
        </div>
      </Card>

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
