// SubscriptionService — creates subscriptions (optionally from a template),
// computes lines by batch-loading products and taxes (no N+1), handles transitions.
import { ObjectId } from 'mongodb';
import {
  NotFoundError, ValidationError, ForbiddenError, translateMongoError,
} from '../../core/AppError.js';
import { CounterService } from './CounterService.js';
import { MONTHLY_FACTOR } from '../../core/BillingPeriod.js';

const DEFAULT_QUOTATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class SubscriptionService {
  /**
   * @param {{ subscriptionRepo, planRepo, templateRepo, productRepo, taxRepo, txManager, eventBus, subscriptionStateMachine }} deps
   */
  constructor({ subscriptionRepo, planRepo, templateRepo, productRepo, taxRepo, customerRepo, invoiceRepo, txManager, eventBus, subscriptionStateMachine }) {
    this.subscriptionRepo = subscriptionRepo;
    this.invoiceRepo = invoiceRepo;
    this.planRepo = planRepo;
    this.templateRepo = templateRepo;
    this.productRepo = productRepo;
    this.taxRepo = taxRepo;
    this.customerRepo = customerRepo;
    this.txManager = txManager;
    this.eventBus = eventBus;
    this.sm = subscriptionStateMachine;
    this.counter = new CounterService();
  }

  async list(query, actor) {
    const limit = Number(query.limit) || 20;
    const filter = { ...query, limit };
    // Customer scope: only their own.
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer) return { data: [], hasMore: false };
      filter.customerId = customer._id.toString();
    }
    if (query.q?.trim() && actor.role !== 'CUSTOMER') {
      filter.qCustomerIds = await this.customerRepo.findIdsMatching(query.q);
    }
    const rows = await this.subscriptionRepo.listWithPlanName(filter);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore };
  }

  /** Detail: subscription + plan + customer (one aggregation) and its invoices (one find). */
  async getById(id, actor) {
    const sub = await this.subscriptionRepo.findDetail(id);
    if (!sub) throw new NotFoundError('Subscription');
    await this.assertCanAccess(sub, actor);

    let invoices = await this.invoiceRepo.findBySubscription(sub._id);
    if (actor.role === 'CUSTOMER') invoices = invoices.filter((inv) => inv.status !== 'DRAFT');

    const allowedTransitions = this.sm.allowedTransitions(sub.status, sub.plan || {}, actor)
      // An expired quotation can't be confirmed; it has to go back to draft and be re-sent.
      .filter((to) => !(to === 'CONFIRMED' && this.isQuotationExpired(sub)));
    return {
      ...sub,
      invoices: invoices.map(({ lines, ...inv }) => inv),
      allowedTransitions,
      quotationExpired: this.isQuotationExpired(sub),
      canRenew: actor.role !== 'CUSTOMER' && this.renewBlocker(sub, sub.plan) === null,
    };
  }

  /**
   * Create a subscription.  Lines come from the body or from a templateId.
   * Fetches all referenced products + taxes with two $in queries (no N+1).
   */
  async create(payload, actor) {
    // Load plan
    const plan = await this.planRepo.findById(payload.planId);
    if (!plan) throw new NotFoundError('Plan');
    const customer = await this.customerRepo.findById(payload.customerId);
    if (!customer) throw new NotFoundError('Customer');
    this.assertPlanAvailable(plan, new Date());
    if (payload.startDate && payload.expiryDate && new Date(payload.expiryDate) <= new Date(payload.startDate)) {
      throw new ValidationError('Expiry date must be after the start date');
    }

    // Resolve lines: from template or body
    let lines = payload.lines;
    let quotationValidityDays = DEFAULT_QUOTATION_DAYS;
    if (payload.templateId) {
      const template = await this.templateRepo.findById(payload.templateId);
      if (!template) throw new NotFoundError('Quotation template');
      quotationValidityDays = template.validityDays || DEFAULT_QUOTATION_DAYS;
      lines = template.lines.map((l) => ({
        productId: l.productId.toString(),
        variantId: l.variantId ? l.variantId.toString() : undefined,
        quantity: l.quantity,
      }));
    }
    if (!lines || lines.length === 0) throw new ValidationError('At least one line is required');

    // Batch-load all referenced products — ONE $in query.
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const products = await this.productRepo.findManyByIds(productIds);

    // Batch-load all referenced taxes — ONE $in query.
    const allTaxIds = products.flatMap((p) => p.taxIds || []);
    const uniqueTaxIds = [...new Set(allTaxIds.map((t) => t.toString()))].map((t) => new ObjectId(t));
    const taxes = uniqueTaxIds.length ? await this.taxRepo.findManyByIds(uniqueTaxIds) : [];
    const taxMap = new Map(taxes.map((t) => [t._id.toString(), t]));

    // Build subscription lines with snapshotted prices and tax rates.
    const builtLines = lines.map((line) => {
      const product = products.find((p) => p._id.toString() === line.productId);
      if (!product) throw new NotFoundError(`Product ${line.productId}`);

      // Compute unit price = product sales price + variant extra price.
      let unitPrice = product.salesPrice;
      let variantLabel = '';
      if (line.variantId) {
        const variant = product.variants?.find((v) => v._id.toString() === line.variantId);
        if (!variant) throw new NotFoundError(`Variant ${line.variantId}`);
        unitPrice += variant.extraPrice;
        variantLabel = `${variant.attribute}: ${variant.value}`;
      }

      // Tax rate: snapshot from the product's first tax.
      const productTaxIds = product.taxIds || [];
      const tax = productTaxIds.length ? taxMap.get(productTaxIds[0].toString()) : null;
      const taxRate = tax ? tax.ratePercent : 0;

      const quantity = line.quantity || 1;
      const amount = unitPrice * quantity;

      return {
        productId: new ObjectId(line.productId),
        variantId: line.variantId ? new ObjectId(line.variantId) : undefined,
        name: product.name + (variantLabel ? ` (${variantLabel})` : ''),
        quantity,
        unitPrice,
        taxRate,
        amount,
      };
    });

    // Enforce plan minQuantity
    const totalQuantity = builtLines.reduce((s, l) => s + l.quantity, 0);
    if (plan.minQuantity && totalQuantity < plan.minQuantity) {
      throw new ValidationError(`Minimum quantity is ${plan.minQuantity}, got ${totalQuantity}`);
    }

    const monthlyAmount = this.computeMonthlyAmount(plan, builtLines);
    const number = await this.counter.nextFormatted('SUB', 'subscription');

    const subscription = await this.subscriptionRepo.create({
      number,
      customerId: payload.customerId,
      planId: payload.planId,
      status: 'DRAFT',
      startDate: payload.startDate ? new Date(payload.startDate) : null,
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      paymentTermsDays: payload.paymentTermsDays ?? 30,
      nextInvoiceDate: null,
      lastBilledPeriodEnd: null,
      monthlyAmount,
      quotationValidityDays,
      quotationExpiresAt: null, // set when the subscription is sent as a quotation
      renewalCount: 0,
      lines: builtLines,
    });

    return subscription;
  }

  /**
   * Transition a subscription to a new status.
   * Uses a conditional update so two concurrent transitions can't both succeed.
   */
  async transition(id, to, actor) {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) throw new NotFoundError('Subscription');
    await this.assertCanAccess(sub, actor);

    // Load plan for flag checks
    const plan = await this.planRepo.findById(sub.planId);
    const planFlags = plan ? { allowPause: plan.allowPause, allowEarlyClose: plan.allowEarlyClose } : {};

    this.sm.assertCanTransition(sub.status, to, planFlags, actor);
    if (to === 'CONFIRMED' && this.isQuotationExpired(sub)) {
      throw new ValidationError('This quotation has expired. Move it back to draft and send it again.');
    }

    const set = { status: to };
    // Sending a quotation starts its validity window (from the template, default 30 days).
    if (to === 'QUOTATION') {
      set.quotationExpiresAt = new Date(Date.now() + (sub.quotationValidityDays || DEFAULT_QUOTATION_DAYS) * DAY_MS);
    }
    // On ACTIVE: enter the billing index.  First activation bills from the start date;
    // resuming from PAUSED continues after the last billed period, skipping the paused gap.
    if (to === 'ACTIVE') {
      if (sub.status === 'PAUSED') {
        const resumeAt = sub.lastBilledPeriodEnd || sub.startDate || new Date();
        set.nextInvoiceDate = resumeAt < new Date() ? new Date() : resumeAt;
      } else {
        set.nextInvoiceDate = sub.startDate || new Date();
      }
    }
    // On CLOSED: leave the billing index.
    if (to === 'CLOSED') {
      set.nextInvoiceDate = null;
    }

    const result = await this.subscriptionRepo.transition(id, sub.status, set);
    if (result.matchedCount === 0) {
      throw new ValidationError('Subscription state changed concurrently, please retry');
    }

    // Emit events after commit.
    if (to === 'ACTIVE') this.eventBus.emit('subscription.activated', { subscriptionId: id });
    if (to === 'CLOSED') this.eventBus.emit('subscription.closed', { subscriptionId: id });

    return this.getById(id, actor);
  }

  /**
   * Renew: extend the expiry by one more term of the same length (plan must allow it).
   * If billing had stopped at the old expiry, it resumes from the last billed period.
   */
  async renew(id, actor) {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) throw new NotFoundError('Subscription');
    await this.assertCanAccess(sub, actor);
    const plan = await this.planRepo.findById(sub.planId);
    const blocker = this.renewBlocker(sub, plan);
    if (blocker) throw new ValidationError(blocker);

    const termMs = sub.expiryDate.getTime() - sub.startDate.getTime();
    const set = { expiryDate: new Date(sub.expiryDate.getTime() + termMs), lastRenewedAt: new Date() };
    if (sub.status === 'ACTIVE' && !sub.nextInvoiceDate) {
      set.nextInvoiceDate = sub.lastBilledPeriodEnd || sub.startDate;
    }
    const result = await this.subscriptionRepo.renew(id, sub.status, set);
    if (result.matchedCount === 0) throw new ValidationError('Subscription changed concurrently, please retry');

    this.eventBus.emit('subscription.renewed', { subscriptionId: id });
    return this.getById(id, actor);
  }

  /** Why this subscription can't be renewed, or null if it can. */
  renewBlocker(sub, plan) {
    if (!plan?.allowRenew) return 'This plan does not allow renewal';
    if (!['ACTIVE', 'PAUSED'].includes(sub.status)) return 'Only active or paused subscriptions can be renewed';
    if (!sub.startDate || !sub.expiryDate) return 'Subscription has no fixed term to renew';
    return null;
  }

  isQuotationExpired(sub) {
    return sub.status === 'QUOTATION' && sub.quotationExpiresAt && new Date(sub.quotationExpiresAt) < new Date();
  }

  /** A plan can only be sold between its availableFrom and availableTo dates. */
  assertPlanAvailable(plan, on) {
    if (plan.availableFrom && on < new Date(plan.availableFrom)) {
      throw new ValidationError(`Plan "${plan.name}" is not available until ${new Date(plan.availableFrom).toDateString()}`);
    }
    if (plan.availableTo && on > new Date(plan.availableTo)) {
      throw new ValidationError(`Plan "${plan.name}" stopped being available on ${new Date(plan.availableTo).toDateString()}`);
    }
  }

  /** Compute monthlyAmount: yearly / 12, weekly * 52 / 12, daily * 365 / 12. */
  computeMonthlyAmount(plan, lines) {
    const lineTotal = lines.reduce((s, l) => s + l.amount, 0);
    return Math.round(lineTotal * (MONTHLY_FACTOR[plan.billingPeriod] || 1));
  }

  /** Customer access check: can only see their own. */
  async assertCanAccess(sub, actor) {
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer || customer._id.toString() !== sub.customerId.toString()) {
        throw new ForbiddenError('You can only access your own subscriptions');
      }
    }
  }
}
