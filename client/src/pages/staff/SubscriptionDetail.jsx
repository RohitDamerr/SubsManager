// Subscription detail — shows lines, state machine transitions.
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptions } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';

const TRANSITIONS = ['QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'];

export default function SubscriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: sub } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => subscriptions.get(id),
  });

  const transitionMutation = useMutation({
    mutationFn: (to) => subscriptions.transition(id, to),
    onSuccess: () => queryClient.invalidateQueries(['subscription', id]),
  });

  if (!sub) return <div className="page-title">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{sub.number}</h1>
        <StatusBadge status={sub.status} />
      </div>

      <div className="card">
        <div className="card-title">Details</div>
        <table>
          <tbody>
            <tr><td style={{ fontWeight: 600, width: 200 }}>Plan ID</td><td>{sub.planId}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Customer ID</td><td>{sub.customerId}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Start Date</td><td>{sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '—'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Expiry Date</td><td>{sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString() : '—'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Payment Terms</td><td>{sub.paymentTermsDays} days</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Monthly Amount</td><td><MoneyText amount={sub.monthlyAmount} /></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Next Invoice Date</td><td>{sub.nextInvoiceDate ? new Date(sub.nextInvoiceDate).toLocaleDateString() : '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Lines</div>
        <table>
          <thead><tr><th>Name</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Amount</th></tr></thead>
          <tbody>
            {(sub.lines || []).map((l, i) => (
              <tr key={i}>
                <td>{l.name}</td>
                <td>{l.quantity}</td>
                <td><MoneyText amount={l.unitPrice} /></td>
                <td>{l.taxRate}%</td>
                <td><MoneyText amount={l.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">State Transitions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRANSITIONS.map((to) => (
            <button
              key={to}
              className="secondary"
              onClick={() => transitionMutation.mutate(to)}
              disabled={to === sub.status}
            >
              {to}
            </button>
          ))}
        </div>
        {transitionMutation.isError && (
          <div className="error-message" style={{ marginTop: 8 }}>
            {transitionMutation.error.response?.data?.error?.message || 'Transition failed'}
          </div>
        )}
      </div>
    </div>
  );
}
