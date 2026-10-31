// BillingService — bulk billing run (no brute force, no N+1).
//
// Algorithm (section 9):
// 1. Lock
// 2. Select due subscriptions in batches of 500 using the partial index
// 3. Load active discounts once and build the DiscountEngine
// 4. Build invoices in memory (lines are embedded, no second query)
// 5. Write the batch in one transaction (unique index guards double billing)
// 6. On failure, retry one subscription at a time
// 7. Repeat until no due subscriptions remain, then release the lock
import { ObjectId } from 'mongodb';
import { CounterService } from '../subscription/CounterService.js';
import { addPeriods } from '../../core/BillingPeriod.js';

export class BillingService {
  /**
   * @param {{ subscriptionRepo, invoiceRepo, discountRepo, invoiceBuilder, txManager, billingLock, planRepo }} deps
   */
  constructor({ subscriptionRepo, invoiceRepo, discountRepo, customerRepo, invoiceBuilder, txManager, billingLock, planRepo }) {
    this.customerRepo = customerRepo;
    this.subscriptionRepo = subscriptionRepo;
    this.invoiceRepo = invoiceRepo;
    this.discountRepo = discountRepo;
    this.invoiceBuilder = invoiceBuilder;
    this.txManager = txManager;
    this.billingLock = billingLock;
    this.planRepo = planRepo;
    this.counter = new CounterService();
  }

  async run() {
    // 1. Acquire lock
    const acquired = await this.billingLock.acquire(30);
    if (!acquired) {
      return { ran: false, reason: 'Another billing run is active' };
    }

    try {
      // 3. Load active discounts ONCE — reused for the entire run.
      const activeDiscounts = await this.discountRepo.findActiveOnDate(new Date());

      // Cache plans to avoid re-fetching across batches.
      const planCache = new Map();
      let totalCreated = 0;
      let totalErrors = 0;

      // 2 + 7. Loop until no due subscriptions.
      let batch = 0;
      while (true) {
        const subs = await this.subscriptionRepo.findDue(500);
        if (subs.length === 0) break;

        batch++;
        const result = await this.processBatch(subs, activeDiscounts, planCache);
        totalCreated += result.created;
        totalErrors += result.errors;
      }

      // Nightly maintenance: close expired subscriptions on plans that auto-close.
      const autoClosePlans = await this.planRepo.col.find({ autoClose: true }, { projection: { _id: 1 } }).toArray();
      await this.subscriptionRepo.autoCloseExpired(autoClosePlans.map((p) => p._id));

      return { ran: true, batches: batch, created: totalCreated, errors: totalErrors };
    } finally {
      await this.billingLock.release();
    }
  }

  /**
   * Process a batch of subscriptions.
   * Builds invoices in memory, writes in one transaction.
   * On failure, retries one subscription at a time.
   */
  async processBatch(subscriptions, activeDiscounts, planCache) {
    // Load plans for all subs in this batch (one $in query).
    const planIds = [...new Set(subscriptions.map((s) => s.planId.toString()))];
    const planIdsToLoad = planIds.filter((id) => !planCache.has(id));
    if (planIdsToLoad.length) {
      const plans = await this.planRepo.findManyByIds(planIdsToLoad);
      plans.forEach((p) => planCache.set(p._id.toString(), p));
    }

    // Snapshot customer names onto the subscriptions (one aggregation for the batch).
    await this.attachCustomerNames(subscriptions);

    // Build all invoice drafts in memory.
    const drafts = [];
    const subscriptionUpdates = [];

    for (const sub of subscriptions) {
      const plan = planCache.get(sub.planId.toString());
      if (!plan) {
        console.warn(`[billing] subscription ${sub._id} has no plan, skipping`);
        continue;
      }

      const periodStart = sub.nextInvoiceDate;
      // Term is over: stop billing (renewal resumes it).  Clearing nextInvoiceDate also
      // stops findDue from returning this subscription again, so the run always terminates.
      if (this.termEnded(sub, periodStart)) {
        subscriptionUpdates.push({ id: sub._id, nextInvoiceDate: null, lastBilledPeriodEnd: sub.lastBilledPeriodEnd });
        continue;
      }
      const periodEnd = this.computePeriodEnd(periodStart, plan.billingPeriod);
      const issueDate = new Date();

      const draft = this.invoiceBuilder.build(sub, plan, activeDiscounts, {
        periodStart,
        periodEnd,
        issueDate,
      });

      // Assign invoice number.
      const number = await this.counter.nextFormatted('INV', 'invoice');
      draft.number = number;

      drafts.push(draft);
      subscriptionUpdates.push({
        id: sub._id,
        nextInvoiceDate: periodEnd,
        lastBilledPeriodEnd: periodEnd,
      });
    }

    // 5. Write the batch in one transaction.
    try {
      await this.txManager.run(async (session) => {
        // Insert invoices.
        if (drafts.length) {
          await this.invoiceRepo.insertMany(drafts, { session });
        }

        // Claim discount usage and insert redemptions.
        for (const draft of drafts) {
          await this.claimDiscounts(draft, session);
        }

        // Advance nextInvoiceDate on all processed subscriptions.
        await this.subscriptionRepo.bulkAdvance(subscriptionUpdates, session);
      });

      return { created: drafts.length, errors: 0 };
    } catch (err) {
      // 6. Failure handling — retry one subscription at a time.
      console.warn(`[billing] batch failed (${err.message}), retrying individually`);
      return this.retryIndividually(subscriptions, activeDiscounts, planCache);
    }
  }

  /** Snapshot customer details (name, email, billing address) onto every subscription in the batch. */
  async attachCustomerNames(subscriptions) {
    const ids = [...new Set(subscriptions.map((s) => s.customerId.toString()))];
    const customers = await this.customerRepo.col.aggregate([
      { $match: { _id: { $in: ids.map((id) => new ObjectId(id)) } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, email: 1 } }] } },
      { $project: { companyName: 1, billingAddress: 1, user: { $arrayElemAt: ['$user', 0] } } },
    ]).toArray();
    const byId = new Map(customers.map((c) => [c._id.toString(), c]));
    for (const sub of subscriptions) {
      const c = byId.get(sub.customerId.toString());
      sub.customerName = c?.companyName || c?.user?.name || '';
      sub.customerEmail = c?.user?.email || '';
      sub.billingAddress = c?.billingAddress || '';
    }
  }

  /** True when the period would start on/after the subscription's expiry. */
  termEnded(sub, periodStart) {
    return Boolean(sub.expiryDate && periodStart >= sub.expiryDate);
  }

  async retryIndividually(subscriptions, activeDiscounts, planCache) {
    let created = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const plan = planCache.get(sub.planId.toString());
        if (!plan) { errors++; continue; }

        const periodStart = sub.nextInvoiceDate;
        if (this.termEnded(sub, periodStart)) {
          await this.subscriptionRepo.bulkAdvance([{ id: sub._id, nextInvoiceDate: null, lastBilledPeriodEnd: sub.lastBilledPeriodEnd }]);
          continue;
        }
        const periodEnd = this.computePeriodEnd(periodStart, plan.billingPeriod);
        const issueDate = new Date();

        const draft = this.invoiceBuilder.build(sub, plan, activeDiscounts, {
          periodStart, periodEnd, issueDate,
        });

        const number = await this.counter.nextFormatted('INV', 'invoice');
        draft.number = number;

        await this.txManager.run(async (session) => {
          // Check if an invoice already exists for this period (unique index guard).
          const existing = await this.invoiceRepo.findByPeriod(sub._id, periodStart, { session });
          if (existing) {
            // Already billed — just move the subscription past this period so it isn't due again.
            await this.subscriptionRepo.bulkAdvance([{ id: sub._id, nextInvoiceDate: periodEnd, lastBilledPeriodEnd: periodEnd }], session);
            return;
          }

          await this.invoiceRepo.insertOne(draft, { session });
          await this.claimDiscounts(draft, session);
          await this.subscriptionRepo.bulkAdvance([{
            id: sub._id,
            nextInvoiceDate: periodEnd,
            lastBilledPeriodEnd: periodEnd,
          }], session);
        });
        created++;
      } catch (err) {
        console.error(`[billing] subscription ${sub._id} failed: ${err.message}`);
        errors++;
      }
    }

    return { created, errors };
  }

  /**
   * Claim discount usage atomically and insert redemption records.
   */
  async claimDiscounts(draft, session) {
    // Product-scope discounts.
    for (const applied of (draft.appliedProductDiscountIds || [])) {
      const claimed = await this.discountRepo.claimUsage(applied.discountId, session);
      if (claimed) {
        await this.discountRepo.addRedemption({
          discountId: new ObjectId(applied.discountId),
          invoiceId: draft._id,
          amount: draft.lines.find((l) => l.productId?.toString() === applied.productId?.toString())?.productDiscountAmount || 0,
        }, session);
      }
    }

    // Subscription-scope discount.
    if (draft.appliedSubscriptionDiscountId) {
      const claimed = await this.discountRepo.claimUsage(draft.appliedSubscriptionDiscountId, session);
      if (claimed) {
        await this.discountRepo.addRedemption({
          discountId: new ObjectId(draft.appliedSubscriptionDiscountId),
          invoiceId: draft._id,
          amount: draft.subscriptionDiscountAmount || 0,
        }, session);
      }
    }
  }

  /** End of the billing period (calendar-aware: monthly = next calendar month). */
  computePeriodEnd(periodStart, billingPeriod) {
    return addPeriods(periodStart, billingPeriod, 1);
  }
}
