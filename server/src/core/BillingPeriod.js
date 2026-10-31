// BillingPeriod — calendar-aware period arithmetic shared by subscriptions and billing.
// MONTHLY/YEARLY step by calendar month/year (Jan 31 → Feb 28/29), not a fixed day count.

/** Monthly-equivalent multiplier for MRR: yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12. */
export const MONTHLY_FACTOR = { DAILY: 365 / 12, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 };

/** Date `n` billing periods after `date`. */
export function addPeriods(date, billingPeriod, n = 1) {
  const d = new Date(date);
  switch (billingPeriod) {
    case 'DAILY': d.setDate(d.getDate() + n); return d;
    case 'WEEKLY': d.setDate(d.getDate() + 7 * n); return d;
    case 'YEARLY': return addMonthsClamped(d, 12 * n);
    case 'MONTHLY':
    default: return addMonthsClamped(d, n);
  }
}

// setMonth overflows (Jan 31 + 1 month = Mar 3); clamp to the last day of the target month instead.
function addMonthsClamped(d, months) {
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}
