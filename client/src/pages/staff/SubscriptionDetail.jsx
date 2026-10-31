// Subscription detail — all roles (server scopes customers to their own).
// Action buttons come from `allowedTransitions`, computed by the server for this user + plan.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptions } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLES } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Modal, PageHeader, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, isOverdue, PERIOD_LABEL } from '../../lib/format.js';

const ACTION = {
  QUOTATION: { label: 'Send as quotation', tone: 'secondary' },
  DRAFT: { label: 'Back to draft', tone: 'secondary' },
  CONFIRMED: { label: 'Confirm', tone: '' },
  ACTIVE: { label: 'Activate', tone: '' },
  PAUSED: { label: 'Pause', tone: 'secondary' },
  CLOSED: { label: 'Close subscription', tone: 'danger', confirm: 'Closing stops all future billing. This cannot be undone.' },
};
const RESUME = { label: 'Resume', tone: '' };

export default function SubscriptionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(null);
  const isCustomer = user.role === ROLES.CUSTOMER;

  const q = useQuery({ queryKey: ['subscription', id], queryFn: () => subscriptions.get(id) });

  const transition = useMutation({
    mutationFn: (to) => subscriptions.transition(id, to),
    onSuccess: (sub) => {
      queryClient.setQueryData(['subscription', id], sub);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast(`Subscription is now ${sub.status.toLowerCase()}`);
      setConfirming(null);
    },
    onError: () => setConfirming(null),
  });

  const back = isCustomer ? { to: '/my-subscriptions', label: 'My subscriptions' } : { to: '/subscriptions', label: 'Subscriptions' };
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <><PageHeader title="Subscription" back={back} /><ErrorAlert error={q.error} fallback="Could not load this subscription" /></>;

  const sub = q.data;
  const plan = sub.plan || {};
  const lineTotal = (sub.lines || []).reduce((s, l) => s + l.amount, 0);

  const run = (to) => {
    const a = ACTION[to];
    if (a?.confirm) setConfirming(to);
    else transition.mutate(to);
  };

  return (
    <div>
      <PageHeader
        back={back}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{sub.number} <StatusBadge status={sub.status} /></span>}
        subtitle={`${plan.name || 'Plan'} · ${PERIOD_LABEL[plan.billingPeriod] || ''}${isCustomer ? '' : ` · ${sub.customerName || 'Customer'}`}`}
        actions={sub.allowedTransitions.map((to) => {
          const a = sub.status === 'PAUSED' && to === 'ACTIVE' ? RESUME : ACTION[to];
          return (
            <button key={to} className={a.tone} disabled={transition.isPending} onClick={() => run(to)}>{a.label}</button>
          );
        })}
      />
      <ErrorAlert error={transition.error} fallback="Transition failed" />

      <div className="grid-2">
        <Card title="Lines" bodyless>
          <DataTable
            data={sub.lines || []}
            columns={[
              { key: 'name', label: 'Item' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'unitPrice', label: 'Unit price', align: 'right', render: (l) => <MoneyText amount={l.unitPrice} /> },
              { key: 'taxRate', label: 'Tax', align: 'right', render: (l) => `${l.taxRate}%` },
              { key: 'amount', label: 'Amount', align: 'right', render: (l) => <MoneyText amount={l.amount} /> },
            ]}
          />
          <div className="card-body" style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, borderTop: '1px solid var(--border)' }}>
            <span className="muted">Per billing period (before tax & discounts)</span>
            <strong><MoneyText amount={lineTotal} /></strong>
          </div>
        </Card>

        <Card title="Details">
          <dl className="kv">
            {!isCustomer && <><dt>Customer</dt><dd>{sub.customerName || '—'}<div className="subtle">{sub.customerEmail}</div></dd></>}
            <dt>Start</dt><dd>{formatDate(sub.startDate)}</dd>
            <dt>Expiry</dt><dd>{formatDate(sub.expiryDate)}</dd>
            <dt>Next invoice</dt><dd>{formatDate(sub.nextInvoiceDate)}</dd>
            <dt>Payment terms</dt><dd>{sub.paymentTermsDays} days</dd>
            <dt>Per month</dt><dd><MoneyText amount={sub.monthlyAmount} /></dd>
            <dt>Plan rules</dt>
            <dd>
              {plan.allowPause && <span className="chip">Can pause</span>}
              {plan.allowEarlyClose && <span className="chip">Early close</span>}
              {plan.autoClose && <span className="chip">Auto-closes at expiry</span>}
              {!plan.allowPause && !plan.allowEarlyClose && !plan.autoClose && <span className="muted">—</span>}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Invoices" bodyless>
        {sub.invoices.length ? (
          <DataTable
            data={sub.invoices}
            onRowClick={(i) => navigate(`/invoices/${i._id}`)}
            columns={[
              { key: 'number', label: 'Invoice', render: (i) => <span className="strong">{i.number || 'Draft'}</span> },
              { key: 'period', label: 'Period', render: (i) => `${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}` },
              { key: 'dueDate', label: 'Due', render: (i) => formatDate(i.dueDate) },
              { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} overdue={isOverdue(i)} /> },
              { key: 'total', label: 'Total', align: 'right', render: (i) => <MoneyText amount={i.total} /> },
            ]}
          />
        ) : (
          <Empty title="No invoices yet">{sub.status === 'ACTIVE' ? 'The first invoice is created on the next billing run.' : 'Invoices start once the subscription is active.'}</Empty>
        )}
      </Card>

      {confirming && (
        <Modal title={ACTION[confirming].label} onClose={() => setConfirming(null)}>
          <p style={{ marginBottom: 18 }}>{ACTION[confirming].confirm}</p>
          <div className="form-actions">
            <button className="secondary" onClick={() => setConfirming(null)}>Keep it</button>
            <button className="danger" disabled={transition.isPending} onClick={() => transition.mutate(confirming)}>{ACTION[confirming].label}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
