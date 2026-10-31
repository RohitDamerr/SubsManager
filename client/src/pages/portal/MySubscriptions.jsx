// Customer portal — my subscriptions (read + pause/close if plan allows).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { subscriptions } from '../../api/resources.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';

export default function MySubscriptions() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['my-subscriptions'], queryFn: () => subscriptions.list({ limit: 50 }) });

  const transitionMutation = useMutation({
    mutationFn: ({ id, to }) => subscriptions.transition(id, to),
    onSuccess: () => queryClient.invalidateQueries(['my-subscriptions']),
  });

  return (
    <div>
      <h1 className="page-title">My Subscriptions</h1>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Plan</th><th>Status</th><th>Monthly</th><th>Next Invoice</th><th>Actions</th><th></th></tr></thead>
          <tbody>
            {(data?.data || []).map((s) => (
              <tr key={s._id}>
                <td>{s.number}</td>
                <td>{s.planName || '—'}</td>
                <td><StatusBadge status={s.status} /></td>
                <td><MoneyText amount={s.monthlyAmount} /></td>
                <td>{s.nextInvoiceDate ? new Date(s.nextInvoiceDate).toLocaleDateString() : '—'}</td>
                <td>
                  {s.status === 'ACTIVE' && (
                    <>
                      <button className="secondary" style={{ padding: '4px 10px', marginRight: 4 }}
                        onClick={() => transitionMutation.mutate({ id: s._id, to: 'PAUSED' })}>Pause</button>
                      <button className="danger" style={{ padding: '4px 10px' }}
                        onClick={() => transitionMutation.mutate({ id: s._id, to: 'CLOSED' })}>Close</button>
                    </>
                  )}
                  {s.status === 'PAUSED' && (
                    <button style={{ padding: '4px 10px' }}
                      onClick={() => transitionMutation.mutate({ id: s._id, to: 'ACTIVE' })}>Resume</button>
                  )}
                </td>
                <td><Link to={`/subscriptions/${s._id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
