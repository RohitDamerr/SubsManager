// Formatting helpers.  Money is always integer minor units (paise) on the wire.
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export function formatMoney(paise) {
  if (paise == null || Number.isNaN(paise)) return '—';
  return inr.format(paise / 100);
}

/** "1,234.50" typed by a user → 123450 paise.  Empty → undefined. */
export function toPaise(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

export function fromPaise(paise) {
  return paise == null ? '' : (paise / 100).toFixed(2);
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** yyyy-mm-dd for <input type="date">. */
export function dateInput(d = new Date()) {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function isOverdue(invoice) {
  return invoice?.status === 'CONFIRMED' && invoice.dueDate && new Date(invoice.dueDate) < new Date();
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export const PERIOD_LABEL = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };
