// Invoice detail — all roles (server scopes customers to their own, non-draft invoices).
// Staff & Admin: confirm, cancel, send, record payment.  Everyone: print.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoices, payments } from '../../api/resources.js';
import { errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can, ROLES } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { dateInput, formatDate, fromPaise, isOverdue, toPaise } from '../../lib/format.js';

const METHODS = [['CASH', 'Cash'], ['BANK_TRANSFER', 'Bank transfer'], ['CARD', 'Card'], ['UPI', 'UPI'], ['CHEQUE', 'Cheque']];

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const canManage = can(user, 'invoice:manage');
  const isCustomer = user.role === ROLES.CUSTOMER;

  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => invoices.get(id) });

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    if (msg) toast(msg);
  };
  const onError = (err) => toast(errorMessage(err, 'Action failed'), 'error');

  const confirm = useMutation({ mutationFn: () => invoices.confirm(id), onSuccess: (i) => refresh(`Invoice ${i.number} confirmed`), onError });
  const cancel = useMutation({ mutationFn: () => invoices.cancel(id), onSuccess: () => { setCancelling(false); refresh('Invoice cancelled'); }, onError });
  const send = useMutation({ mutationFn: () => invoices.send(id), onSuccess: () => refresh('Invoice emailed to the customer'), onError });

  const print = async () => {
    // Open the window synchronously (popup blockers), then fill it once the HTML arrives.
    const w = window.open('', '_blank');
    try {
      const html = await invoices.printHtml(id);
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      w?.close();
      onError(err);
    }
  };

  const back = isCustomer ? { to: '/my-invoices', label: 'My invoices' } : { to: '/invoices', label: 'Invoices' };
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <><PageHeader title="Invoice" back={back} /><ErrorAlert error={q.error} fallback="Could not load this invoice" /></>;

  const inv = q.data;
  const owed = inv.total - inv.amountPaid;
  const busy = confirm.isPending || cancel.isPending || send.isPending;

  return (
    <div>
      <PageHeader
        back={back}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{inv.number || 'Draft invoice'} <StatusBadge status={inv.status} overdue={isOverdue(inv)} /></span>}
        subtitle={<>
          {!isCustomer && <>{inv.customerName || 'Customer'} · </>}
          {inv.subscriptionNumber && <Link to={`/subscriptions/${inv.subscriptionId}`}>{inv.subscriptionNumber}</Link>}
          {inv.sentAt && <> · emailed {formatDate(inv.sentAt)}</>}
        </>}
        actions={<>
          {canManage && inv.status === 'DRAFT' && <button onClick={() => confirm.mutate()} disabled={busy}>Confirm invoice</button>}
          {can(user, 'payment:record') && inv.status === 'CONFIRMED' && <button onClick={() => setPaying(true)} disabled={busy}>Record payment</button>}
          {canManage && inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && (
            <button className="secondary" onClick={() => send.mutate()} disabled={busy}>{send.isPending ? 'Sending…' : 'Email to customer'}</button>
          )}
          <button className="secondary" onClick={print}>Print</button>
          {canManage && ['DRAFT', 'CONFIRMED'].includes(inv.status) && inv.amountPaid === 0 && (
            <button className="danger" onClick={() => setCancelling(true)} disabled={busy}>Cancel</button>
          )}
        </>}
      />

      <div className="grid-2">
        <Card title="Lines" bodyless>
          <DataTable
            data={inv.lines || []}
            columns={[
              { key: 'description', label: 'Item' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'unitPrice', label: 'Unit', align: 'right', render: (l) => <MoneyText amount={l.unitPrice} /> },
              { key: 'discountAmount', label: 'Discount', align: 'right', render: (l) => (l.discountAmount ? <>−<MoneyText amount={l.discountAmount} /></> : '—') },
              { key: 'taxAmount', label: 'Tax', align: 'right', render: (l) => <><MoneyText amount={l.taxAmount} /> <span className="subtle">{l.taxRate}%</span></> },
              { key: 'lineTotal', label: 'Total', align: 'right', render: (l) => <MoneyText amount={l.lineTotal} /> },
            ]}
          />
        </Card>

        <Card title="Summary">
          <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Period</dt><dd>{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</dd>
            <dt>Issued</dt><dd>{formatDate(inv.issueDate)}</dd>
            <dt>Due</dt><dd style={isOverdue(inv) ? { color: 'var(--danger)' } : {}}>{formatDate(inv.dueDate)}</dd>
            <dt>Subtotal</dt><dd className="num"><MoneyText amount={inv.subtotal} /></dd>
            <dt>Discount</dt><dd className="num">−<MoneyText amount={inv.discountTotal} /></dd>
            <dt>Tax</dt><dd className="num"><MoneyText amount={inv.taxTotal} /></dd>
            <dt className="strong" style={{ color: 'var(--text)' }}>Total</dt><dd className="num strong"><MoneyText amount={inv.total} /></dd>
            <dt>Paid</dt><dd className="num"><MoneyText amount={inv.amountPaid} /></dd>
            <dt className="strong" style={{ color: 'var(--text)' }}>Balance</dt><dd className="num strong"><MoneyText amount={inv.status === 'CANCELLED' ? 0 : owed} /></dd>
          </dl>
        </Card>
      </div>

      <Card title="Payments" bodyless>
        {inv.payments?.length ? (
          <DataTable
            data={inv.payments}
            columns={[
              { key: 'paidOn', label: 'Date', render: (p) => formatDate(p.paidOn) },
              { key: 'method', label: 'Method', render: (p) => METHODS.find(([v]) => v === p.method)?.[1] || p.method },
              { key: 'note', label: 'Note', render: (p) => p.note || <span className="muted">—</span> },
              { key: 'amount', label: 'Amount', align: 'right', render: (p) => <MoneyText amount={p.amount} /> },
            ]}
          />
        ) : <Empty title="No payments yet" />}
      </Card>

      {paying && <RecordPayment invoice={inv} onClose={() => setPaying(false)} onDone={() => { setPaying(false); refresh('Payment recorded'); }} />}

      {cancelling && (
        <Modal title="Cancel invoice" onClose={() => setCancelling(false)}>
          <p style={{ marginBottom: 18 }}>The invoice is voided, its discount usage is released, and the period can be billed again.</p>
          <div className="form-actions">
            <button className="secondary" onClick={() => setCancelling(false)}>Keep invoice</button>
            <button className="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel invoice</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RecordPayment({ invoice, onClose, onDone }) {
  const owed = invoice.total - invoice.amountPaid;
  const [form, setForm] = useState({ method: 'UPI', amount: fromPaise(owed), paidOn: dateInput(), note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const record = useMutation({ mutationFn: (b) => payments.record(invoice._id, b), onSuccess: onDone });

  const amount = toPaise(form.amount);
  const tooMuch = amount > owed;

  const handleSubmit = (e) => {
    e.preventDefault();
    const b = { method: form.method, amount, paidOn: new Date(form.paidOn).toISOString() };
    if (form.note.trim()) b.note = form.note.trim();
    record.mutate(b);
  };

  return (
    <Modal title={`Record payment — ${invoice.number}`} onClose={onClose}>
      <ErrorAlert error={record.error} />
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Amount (₹)" hint={`Outstanding: ${fromPaise(owed)}`}>
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} required autoFocus />
          </Field>
          <Field label="Method">
            <select value={form.method} onChange={set('method')}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Paid on"><input type="date" value={form.paidOn} onChange={set('paidOn')} required /></Field>
        </div>
        <Field label="Note (optional)"><input value={form.note} onChange={set('note')} placeholder="Reference number, cheque no…" /></Field>
        {tooMuch && <div className="alert alert-error">Amount is more than the outstanding balance.</div>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!amount || tooMuch || record.isPending}>{record.isPending ? 'Saving…' : 'Record payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
