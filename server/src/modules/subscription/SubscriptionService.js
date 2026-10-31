// SubscriptionService — creates subscriptions (optionally from a template),
// computes lines by batch-loading products and taxes (no N+1), handles transitions.
import { ObjectId } from 'mongodb';
import {
  NotFoundError, ValidationError, ForbiddenError, translateMongoError,
} from '../../core/AppError.js';
import { CounterService } from './CounterService.js';

const PERIOD_DAYS = { DAILY: 1, WEEKLY: 7, MONTHLY: 30, YEARLY: 365 };
const PERIOD_MONTHS = { DAILY: 1 / 30, WEEKLY: 7 / 30, MONTHLY: 1, YEARLY: 12 };

export class SubscriptionService {
  /**
   * @param {{ subscriptionRepo, planRepo, templateRepo, productRepo, taxRepo, txManager, eventBus, subscriptionStateMachine }} deps
   */
  constructor({ subscriptionRepo, planRepo, templateRepo, productRepo, taxRepo, customerRepo, txManager, eventBus, subscriptionStateMachine }) {
    this.subscriptionRepo = subscriptionRepo;
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
    const rows = await this.subscriptionRepo.listWithPlanName(filter);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore };
  }

  async getById(id, actor) {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) throw new NotFoundError('Subscription');
    await this.assertCanAccess(sub, actor);
    return sub;
  }

  /**
   * Create a subscription.  Lines come from the body or from a templateId.
   * Fetches all referenced products + taxes with two $in queries (no N+1).
   */
  async create(payload, actor) {
    // Load plan
    const plan = await this.planRepo.findById(payload.planId);
    if (!plan) throw new NotFoundError('Plan');

    // Resolve lines: from template or body
    let lines = payload.lines;
    if (payload.templateId) {
      const template = await this.templateRepo.findById(payload.templateId);
      if (!template) throw new NotFoundError('Quotation template');
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

    const set = { status: to };
    // On ACTIVE: set nextInvoiceDate = startDate to enter the billing index.
    if (to === 'ACTIVE') {
      set.nextInvoiceDate = sub.startDate || new Date();
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

    return this.subscriptionRepo.findById(id);
  }

  /** Compute monthlyAmount: yearly / 12, weekly * 52 / 12, daily * 365 / 12. */
  computeMonthlyAmount(plan, lines) {
    const lineTotal = lines.reduce((s, l) => s + l.amount, 0);
    const months = PERIOD_MONTHS[plan.billingPeriod] || 1;
    return Math.round(lineTotal * months);
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
