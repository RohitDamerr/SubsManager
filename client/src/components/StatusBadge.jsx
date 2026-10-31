// StatusBadge — single component for subscription and invoice states.
// Pass `overdue` to show a confirmed invoice past its due date as OVERDUE.
const STATUS_TONE = {
  DRAFT: 'gray',
  QUOTATION: 'blue',
  CONFIRMED: 'indigo',
  ACTIVE: 'green',
  PAUSED: 'amber',
  CLOSED: 'gray',
  PAID: 'green',
  CANCELLED: 'red',
  OVERDUE: 'red',
};

export function StatusBadge({ status, overdue = false }) {
  if (!status) return null;
  const shown = overdue ? 'OVERDUE' : status;
  const label = shown.charAt(0) + shown.slice(1).toLowerCase();
  return <span className={`badge badge-${STATUS_TONE[shown] || 'gray'}`}>{label}</span>;
}
