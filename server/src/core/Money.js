// Money value object — all amounts stored as integer minor units (paise).
// No floating point anywhere.  BigDecimal-style safety with plain integers.

export class Money {
  /**
   * @param {number} amount - integer minor units (paise)
   */
  constructor(amount) {
    if (!Number.isInteger(amount)) {
      throw new Error(`Money amount must be an integer (minor units), got ${amount}`);
    }
    this.amount = amount;
  }

  static zero() { return new Money(0); }

  static fromDecimal(value) {
    return new Money(Math.round(value * 100));
  }

  add(other) { return new Money(this.amount + other.amount); }
  sub(other) { return new Money(this.amount - other.amount); }

  /** multiply by an integer scalar */
  mul(factor) { return new Money(this.amount * factor); }

  /** percentage (0-100) as Money */
  percent(p) { return new Money(Math.round((this.amount * p) / 100)); }

  min(other) { return new Money(Math.min(this.amount, other.amount)); }
  max(other) { return new Money(Math.max(this.amount, other.amount)); }

  isZero() { return this.amount === 0; }
  isPositive() { return this.amount > 0; }
  isNegative() { return this.amount < 0; }
  gte(other) { return this.amount >= other.amount; }
  lte(other) { return this.amount <= other.amount; }
  gt(other) { return this.amount > other.amount; }
  lt(other) { return this.amount < other.amount; }
  equals(other) { return this.amount === other.amount; }

  /** e.g. 56000 -> "₹560.00" */
  format(symbol = '₹') {
    const sign = this.amount < 0 ? '-' : '';
    const abs = Math.abs(this.amount);
    const rupees = Math.floor(abs / 100);
    const paise = abs % 100;
    return `${sign}${symbol}${rupees}.${String(paise).padStart(2, '0')}`;
  }

  toDecimal() { return this.amount / 100; }

  /** Serialise to plain integer for MongoDB */
  toJSON() { return this.amount; }

  static fromJSON(v) {
    if (v instanceof Money) return v;
    if (typeof v === 'number') return new Money(v);
    if (v == null) return Money.zero();
    return new Money(v);
  }
}
