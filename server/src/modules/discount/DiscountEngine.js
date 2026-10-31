// DiscountEngine — evaluates active discounts against invoice draft lines.
// Pull-based: nobody links a discount to an invoice; the engine finds qualifiers.
//
// Stacking policy (section 7.4):
// 1. For each line, pick at most one PRODUCT discount: the one with the largest reduction.
// 2. Then pick at most one SUBSCRIPTION discount: the best one, on subtotal after line discounts.
// 3. A discount can never reduce a base below zero (FIXED is capped at base).
// 4. Tax is computed AFTER discounts, on the discounted amount.
//
// Built from ONE query at billing time, reused for every subscription in the batch.

import { Money } from '../../core/Money.js';
import { createDiscountRule } from './DiscountRule.js';

export class DiscountEngine {
  /**
   * @param {Array} activeDiscounts - loaded once from one query
   */
  constructor(activeDiscounts) {
    this.productDiscounts = activeDiscounts.filter((d) => d.scope === 'PRODUCT' && d.isActive);
    this.subscriptionDiscounts = activeDiscounts.filter((d) => d.scope === 'SUBSCRIPTION' && d.isActive);
  }

  /**
   * Check eligibility of a discount against a context.
   * @param {object} discount
   * @param {{ date: Date, subtotal?: number, quantity?: number, productId?: string }} ctx
   * @returns {boolean}
   */
  isEligible(discount, ctx) {
    // Date range
    const now = ctx.date || new Date();
    if (discount.startDate && now < discount.startDate) return false;
    if (discount.endDate && now > discount.endDate) return false;

    // Usage limit — checked separately (atomic claim at invoice creation), but skip if exhausted.
    if (discount.usageLimit !== null && discount.usageLimit !== undefined) {
      if ((discount.usedCount || 0) >= discount.usageLimit) return false;
    }

    // Min purchase
    if (discount.minPurchase !== undefined && discount.minPurchase !== null) {
      if ((ctx.subtotal || 0) < discount.minPurchase) return false;
    }

    // Min quantity
    if (discount.minQuantity !== undefined && discount.minQuantity !== null) {
      if ((ctx.quantity || 0) < discount.minQuantity) return false;
    }

    // Product match (for PRODUCT scope)
    if (discount.scope === 'PRODUCT' && discount.productIds?.length > 0) {
      if (!ctx.productId) return false;
      const productIds = discount.productIds.map((p) => p.toString());
      if (!productIds.includes(ctx.productId?.toString())) return false;
    }

    return true;
  }

  /**
   * Apply discounts to an invoice draft.
   * Mutates lines in place, returns the draft with discountAmount per line and discountTotal.
   *
   * @param {object} draft - { lines: [{ productId, amount, quantity, ... }] }
   * @param {Date} [date]
   * @returns {object} draft with discount info applied
   */
  apply(draft, date = new Date()) {
    let lineDiscountTotal = 0;

    // Step 1: per-line PRODUCT discounts — pick the best one for each line.
    for (const line of draft.lines) {
      line.discountAmount = 0;
      line.discountId = null;

      const eligible = this.productDiscounts.filter((d) =>
        this.isEligible(d, { date, productId: line.productId, subtotal: line.amount, quantity: line.quantity })
      );

      if (eligible.length === 0) continue;

      // Compute each and pick the one giving the largest reduction.
      let bestAmount = 0;
      let bestDiscount = null;
      for (const d of eligible) {
        const rule = createDiscountRule(d);
        const base = new Money(line.amount);
        const result = rule.compute(base);
        if (result.amount > bestAmount) {
          bestAmount = result.amount;
          bestDiscount = d;
        }
      }

      if (bestDiscount) {
        line.discountAmount = bestAmount;
        line.discountId = bestDiscount._id;
        lineDiscountTotal += bestAmount;
      }
    }

    // Step 2: SUBSCRIPTION discount on the subtotal AFTER line discounts.
    const subtotalAfterLineDiscounts = draft.lines.reduce(
      (sum, l) => sum + (l.amount - (l.discountAmount || 0)),
      0
    );

    let subscriptionDiscountTotal = 0;
    let subscriptionDiscountId = null;

    const totalQuantity = draft.lines.reduce((s, l) => s + (l.quantity || 0), 0);

    const eligibleSub = this.subscriptionDiscounts.filter((d) =>
      this.isEligible(d, { date, subtotal: subtotalAfterLineDiscounts, quantity: totalQuantity })
    );

    if (eligibleSub.length > 0) {
      let bestAmount = 0;
      let bestDiscount = null;
      for (const d of eligibleSub) {
        const rule = createDiscountRule(d);
        const base = new Money(subtotalAfterLineDiscounts);
        const result = rule.compute(base);
        if (result.amount > bestAmount) {
          bestAmount = result.amount;
          bestDiscount = d;
        }
      }
      if (bestDiscount) {
        subscriptionDiscountTotal = bestAmount;
        subscriptionDiscountId = bestDiscount._id;
      }
    }

    draft.discountTotal = lineDiscountTotal + subscriptionDiscountTotal;
    draft.subscriptionDiscountId = subscriptionDiscountId;

    return draft;
  }

  /**
   * Return all discount ids that the engine would apply to a draft.
   * Used to claim usage atomically at invoice creation.
   */
  getApplicableDiscountIds(draft, date = new Date()) {
    const ids = [];
    const applied = this.apply({ ...draft, lines: draft.lines.map((l) => ({ ...l })) }, date);
    for (const line of applied.lines) {
      if (line.discountId) ids.push({ discountId: line.discountId, lineId: line.productId });
    }
    if (applied.subscriptionDiscountId) {
      ids.push({ discountId: applied.subscriptionDiscountId, lineId: null });
    }
    return ids;
  }
}
