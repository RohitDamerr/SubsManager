// TaxEngine — pure code, no database access.  Handles exclusive and inclusive taxes.
// Called with invoice/subscription lines that already have a snapshotted taxRate.

import { Money } from '../../core/Money.js';

export class TaxEngine {
  /**
   * Calculate per-line tax amounts.
   * @param {Array<{ amount: number, taxRate: number, isInclusive?: boolean }>} lines
   *   amount = Money amount (integer minor units)
   *   taxRate = percent (e.g. 18 for 18%)
   *   isInclusive = whether the tax is already included in amount
   * @returns {{ taxAmount: number, netAmount: number }[]} per-line results
   */
  static calculate(lines) {
    return lines.map((line) => {
      const amount = new Money(line.amount || 0);
      const rate = line.taxRate || 0;
      const isInclusive = line.isInclusive || false;

      if (rate === 0) {
        return { taxAmount: 0, netAmount: amount.amount };
      }

      if (isInclusive) {
        // amount is gross; extract the tax portion.
        const net = new Money(Math.round((amount.amount * 100) / (100 + rate)));
        const tax = amount.sub(net);
        return { taxAmount: tax.amount, netAmount: net.amount };
      }

      // Exclusive — tax is added on top.
      const tax = amount.percent(rate);
      return { taxAmount: tax.amount, netAmount: amount.amount };
    });
  }

  /**
   * Convenience: compute total tax for a set of lines.
   * @param {Array<{ amount: number, taxRate: number, isInclusive?: boolean }>} lines
   * @returns {number} total tax in minor units
   */
  static totalTax(lines) {
    return TaxEngine.calculate(lines).reduce((sum, r) => sum + r.taxAmount, 0);
  }
}
