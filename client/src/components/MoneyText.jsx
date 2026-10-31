// MoneyText — formats integer minor units as INR.
import { formatMoney } from '../lib/format.js';

export function MoneyText({ amount }) {
  return <span>{formatMoney(amount)}</span>;
}
