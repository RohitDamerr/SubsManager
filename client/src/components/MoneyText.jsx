// MoneyText — formats integer minor units as currency.
export function MoneyText({ amount, symbol = '₹' }) {
  if (amount == null) return <span>—</span>;
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  const sign = amount < 0 ? '-' : '';
  return <span>{sign}{symbol}{rupees}.{String(paise).padStart(2, '0')}</span>;
}
