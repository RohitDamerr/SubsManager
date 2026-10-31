// PaymentService — records a payment against an invoice in one transaction.
// The invoice update uses a guarded pipeline update so two concurrent
// payments can't over-pay the invoice (atomic single-document update).
import { ObjectId } from 'mongodb';
import {
  NotFoundError, ValidationError, ForbiddenError, ConflictError,
} from '../../core/AppError.js';

export class PaymentService {
  /**
   * @param {{ paymentRepo, invoiceRepo, txManager, eventBus }} deps
   */
  constructor({ paymentRepo, invoiceRepo, customerRepo, txManager, eventBus }) {
    this.paymentRepo = paymentRepo;
    this.invoiceRepo = invoiceRepo;
    this.customerRepo = customerRepo;
    this.txManager = txManager;
    this.eventBus = eventBus;
  }

  /** Payments register; customers only ever see their own. */
  async list(query, actor) {
    const limit = Number(query.limit) || 20;
    const filter = { ...query, limit };
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer) return { data: [], hasMore: false, summary: { total: 0, count: 0 } };
      filter.customerId = customer._id.toString();
    }
    const [rows, summary] = await Promise.all([this.paymentRepo.list(filter), this.paymentRepo.total(filter)]);
    const hasMore = rows.length > limit;
    return { data: hasMore ? rows.slice(0, limit) : rows, hasMore, summary };
  }

  async listByInvoice(invoiceId, actor) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);
    return this.paymentRepo.findByInvoice(invoiceId);
  }

  /**
   * Record a payment against an invoice.
   * Guarded update: only applies if status is CONFIRMED and amount won't exceed total.
   */
  async record(invoiceId, payload, actor) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);

    if (invoice.status === 'DRAFT') {
      throw new ValidationError('Confirm the invoice before recording a payment');
    }
    if (invoice.status === 'CANCELLED') {
      throw new ValidationError('Cannot record a payment on a cancelled invoice');
    }
    if (invoice.status === 'PAID') {
      throw new ValidationError('Invoice is already fully paid');
    }

    return this.txManager.run(async (session) => {
      // Guarded pipeline update — atomic.
      const updated = await this.invoiceRepo.applyPayment(invoiceId, payload.amount, { session });
      if (!updated) {
        throw new ValidationError('Payment would exceed the outstanding balance, or the invoice is not confirmed');
      }

      // Insert the payment document in the same transaction.
      await this.paymentRepo.create({
        invoiceId,
        customerId: invoice.customerId,
        method: payload.method,
        amount: payload.amount,
        paidOn: payload.paidOn,
        note: payload.note,
        recordedBy: actor._id,
      }, { session });

      this.eventBus.emit('payment.recorded', { invoiceId, amount: payload.amount });
      return updated;
    });
  }

  async assertCanAccess(invoice, actor) {
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer || customer._id.toString() !== invoice.customerId.toString()) {
        throw new ForbiddenError('You can only access your own invoices');
      }
    }
  }
}
