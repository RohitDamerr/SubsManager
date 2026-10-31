// Invoice detail — lines, payments, actions (confirm, cancel, send, print).
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoices, payments } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { useState } from 'react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({ method: 'CASH', amount: '', note: '' });

  const { data: invoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoices.get(id),
  });

  const confirmMutation = useMutation({
    mutationFn: () => invoices.confirm(id),
    onSuccess: () => queryClient.invalidateQueries(['invoice', id]),
  });
  const cancelMutation = useMutation({
    mutationFn: () => invoices.cancel(id),
    onSuccess: () => queryClient.invalidateQueries(['invoice', id]),
  });
  const sendMutation = useMutation({
    mutationFn: () => invoices.send(id),
    onSuccess: () => queryClient.invalidateQueries(['invoice', id]),
  });
  const paymentMutation = useMutation({
    mutationFn: (body) => payments.record(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoice', id]);
      setShowPayment(false);
      setPayment({ method: 'CASH', amount: '', note: '' });
    },
  });

  if (!invoice) return <div className="page-title">Loading…</div>;

  const handlePay = (e) => {
    e.preventDefault();
    paymentMutation.mutate({ ...payment, amount: Math.round(parseFloat(payment.amount) * 100) });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{invoice.number || 'Draft Invoice'}</h1>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="card">
        <div className="card-title">Details</div>
        <table>
          <tbody>
            <tr><td style={{ fontWeight: 600, width: 200 }}>Period</td><td>{new Date(invoice.periodStart).toLocaleDateString()} — {new Date(invoice.periodEnd).toLocaleDateString()}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Issue Date</td><td>{new Date(invoice.issueDate).toLocaleDateString()}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Due Date</td><td>{new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Subtotal</td><td><MoneyText amount={invoice.subtotal} /></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Discount</td><td>-<MoneyText amount={invoice.discountTotal} /></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tax</td><td><MoneyText amount={invoice.taxTotal} /></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Total</td><td><strong><MoneyText amount={invoice.total} /></strong></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Paid</td><td><MoneyText amount={invoice.amountPaid} /></td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Lines</div>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
          <tbody>
            {(invoice.lines || []).map((l, i) => (
              <tr key={i}>
                <td>{l.description}</td>
                <td>{l.quantity}</td>
                <td><MoneyText amount={l.unitPrice} /></td>
                <td><MoneyText amount={l.discountAmount} /></td>
                <td><MoneyText amount={l.taxAmount} /></td>
                <td><MoneyText amount={l.lineTotal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Payments</div>
        {(invoice.payments || []).length > 0 ? (
          <table>
            <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>
              {(invoice.payments || []).map((p) => (
                <tr key={p._id}>
                  <td>{new Date(p.paidOn).toLocaleDateString()}</td>
                  <td>{p.method}</td>
                  <td><MoneyText amount={p.amount} /></td>
                  <td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ color: '#6b7280' }}>No payments yet</div>}
      </div>

      {showPayment && invoice.status === 'CONFIRMED' && (
        <div className="card">
          <div className="card-title">Record Payment</div>
          <form onSubmit={handlePay}>
            <div className="row">
              <div className="col form-group">
                <label>Method</label>
                <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div className="col form-group">
                <label>Amount (₹)</label>
                <input type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Note</label>
              <input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
            </div>
            <button type="submit" disabled={paymentMutation.isPending}>Record Payment</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">Actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {invoice.status === 'DRAFT' && (
            <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>Confirm</button>
          )}
          {(invoice.status === 'DRAFT' || invoice.status === 'CONFIRMED') && (
            <>
              <button className="secondary" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>Cancel</button>
            </>
          )}
          {invoice.status === 'CONFIRMED' && (
            <>
              <button className="secondary" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>Send Email</button>
              <button className="secondary" onClick={() => setShowPayment(!showPayment)}>
                {showPayment ? 'Cancel' : 'Record Payment'}
              </button>
            </>
          )}
          <a className="btn secondary" href={invoices.printUrl(id)} target="_blank" rel="noreferrer">Print</a>
        </div>
      </div>
    </div>
  );
}
