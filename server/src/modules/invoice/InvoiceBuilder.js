// InvoiceBuilder — assembles an invoice draft from a subscription.
// Uses DiscountEngine (pull-based) and TaxEngine (pure).  No database access.
import { Money } from '../../core/Money.js';
import { TaxEngine } from '../tax/TaxEngine.js';

export class InvoiceBuilder {
  /**
   * @param {{ taxEngine: TaxEngine, discountEngineFactory: (discounts) => DiscountEngine }} deps
   */
  constructor({ taxEngine, discountEngineFactory }) {
    this.taxEngine = taxEngine;
    this.discountEngineFactory = discountEngineFactory;
  }

  /**
   * Build an invoice draft from a subscription.
   * @param {object} subscription - with embedded lines
   * @param {object} plan - for billing period and payment terms
   * @param {Array} activeDiscounts - loaded once for the batch
   * @param {{ periodStart: Date, periodEnd: Date, issueDate: Date }} period
   * @returns {object} invoice draft (without _id, number)
   */
  build(subscription, plan, activeDiscounts, { periodStart, periodEnd, issueDate }) {
    // Start with subscription lines as invoice lines.
    let lines = subscription.lines.map((l) => ({
      productId: l.productId,
      description: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.unitPrice * l.quantity,
      taxRate: l.taxRate,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: 0,
    }));

    const draft = { lines };
    const discountEngine = this.discountEngineFactory(activeDiscounts);

    // Apply discounts (pull-based): step 1 per-line, step 2 subscription-level.
    discountEngine.apply(draft, issueDate);

    // Compute tax AFTER discounts, on the discounted amount.
    const taxResults = TaxEngine.calculate(
      lines.map((l) => ({ amount: l.amount - (l.discountAmount || 0), taxRate: l.taxRate }))
    );
    lines.forEach((line, i) => {
      const tax = taxResults[i];
      line.taxAmount = tax.taxAmount;
      line.lineTotal = (line.amount - (line.discountAmount || 0)) + line.taxAmount;
    });

    // Totals
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const discountTotal = draft.discountTotal || 0;
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = subtotal - discountTotal + taxTotal;

    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (subscription.paymentTermsDays || 30));

    return {
      subscriptionId: subscription._id,
      customerId: subscription.customerId,
      customerName: subscription.customerName || '',
      status: 'DRAFT',
      billable: true,
      periodStart,
      periodEnd,
      issueDate,
      dueDate,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      amountPaid: 0,
      lines,
      // Track which discounts were applied so we can claim usage + redemptions.
      appliedProductDiscountIds: lines
        .filter((l) => l.discountId)
        .map((l) => ({ discountId: l.discountId, productId: l.productId })),
      appliedSubscriptionDiscountId: draft.subscriptionDiscountId || null,
    };
  }
}
