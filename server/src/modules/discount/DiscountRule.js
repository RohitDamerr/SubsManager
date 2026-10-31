// Discount rule classes — Strategy pattern.  Each rule type differs only in compute().
// FixedAmountRule caps the discount at the base (never negative).
// PercentRule computes a percentage of the base.

import { Money } from '../../core/Money.js';

export class DiscountRule {
  constructor(discount) {
    this.discount = discount;
  }

  /** @returns {boolean} */
  eligible(ctx) { return true; }

  /** @param {Money} base @returns {Money} */
  compute(base) { return Money.zero(); }
}

export class FixedAmountRule extends DiscountRule {
  compute(base) {
    const value = new Money(this.discount.value);
    return value.min(base);
  }
}

export class PercentRule extends DiscountRule {
  compute(base) {
    return base.percent(this.discount.value);
  }
}

/** Factory: build the right rule class from a discount document. */
export function createDiscountRule(discount) {
  if (discount.type === 'FIXED') return new FixedAmountRule(discount);
  if (discount.type === 'PERCENT') return new PercentRule(discount);
  throw new Error(`Unknown discount type: ${discount.type}`);
}
