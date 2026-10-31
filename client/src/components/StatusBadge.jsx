// StatusBadge — single component for subscription and invoice states.
const STATUS_CLASS = {
  DRAFT: 'badge-draft',
  QUOTATION: 'badge-draft',
  CONFIRMED: 'badge-confirmed',
  ACTIVE: 'badge-active',
  PAUSED: 'badge-paused',
  CLOSED: 'badge-closed',
  PAID: 'badge-paid',
  CANCELLED: 'badge-cancelled',
};

export function StatusBadge({ status }) {
  if (!status) return null;
  const cls = STATUS_CLASS[status] || 'badge-draft';
  return <span className={`badge ${cls}`}>{status}</span>;
}
