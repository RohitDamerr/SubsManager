// Customer portal home — the customer's own subscriptions and bills (server-scoped).
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptions, invoices } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, PageHeader, QueryState } from '../../components/ui.jsx';
import { formatDate, formatMoney, isOverdue } from '../../lib/format.js';

export default function PortalHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const subs = useQuery({ queryKey: ['subscriptions', 'mine', 'home'], queryFn: () => subscriptions.list({ limit: 50 }) });
  const invs = useQuery({ queryKey: ['invoices', 'mine', 'home'], queryFn: () => invoices.list({ limit: 50 }) });

  const subRows = subs.data?.data || [];
  const invRows = invs.data?.data || [];
  const active = subRows.filter((s) => s.status === 'ACTIVE');
  const unpaid = invRows.filter((i) => i.status === 'CONFIRMED');
  const owed = unpaid.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const nextBill = active.map((s) => s.nextInvoiceDate).filter(Boolean).sort()[0];

  return (
    <div>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here's where your account stands." />

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Active subscriptions</div><div className="kpi-value">{subs.isLoading ? '…' : active.length}</div></div>
        <div className={`kpi-card ${unpaid.some(isOverdue) ? 'alert' : ''}`}>
          <div className="kpi-label">Amount due</div>
          <div className="kpi-value">{invs.isLoading ? '…' : formatMoney(owed)}</div>
          <div className="kpi-hint">{unpaid.length} unpaid invoice(s){unpaid.some(isOverdue) ? ', some overdue' : ''}</div>
        </div>
        <div className="kpi-card"><div className="kpi-label">Next invoice</div><div className="kpi-value" style={{ fontSize: 20 }}>{formatDate(nextBill)}</div></div>
      </div>

      <div className="grid-2">
        <Card title="Unpaid invoices" bodyless actions={<button className="secondary sm" onClick={() => navigate('/my-invoices')}>All invoices</button>}>
          <QueryState query={invs} isEmpty={!unpaid.length} empty={<Empty title="You're all paid up" />}>
            <DataTable
              data={unpaid}
              onRowClick={(i) => navigate(`/invoices/${i._id}`)}
              columns={[
                { key: 'number', label: 'Invoice', render: (i) => <span className="strong">{i.number}</span> },
                { key: 'dueDate', label: 'Due', render: (i) => formatDate(i.dueDate) },
                { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} overdue={isOverdue(i)} /> },
                { key: 'owed', label: 'Owed', align: 'right', render: (i) => <MoneyText amount={i.total - i.amountPaid} /> },
              ]}
            />
          </QueryState>
        </Card>

        <Card title="My subscriptions" bodyless actions={<button className="secondary sm" onClick={() => navigate('/my-subscriptions')}>Manage</button>}>
          <QueryState query={subs} isEmpty={!subRows.length} empty={<Empty title="No subscriptions yet">Our team will set one up for you.</Empty>}>
            <DataTable
              data={subRows.slice(0, 5)}
              onRowClick={(s) => navigate(`/subscriptions/${s._id}`)}
              columns={[
                { key: 'planName', label: 'Plan', render: (s) => s.planName || s.number },
                { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
              ]}
            />
          </QueryState>
        </Card>
      </div>
    </div>
  );
}
