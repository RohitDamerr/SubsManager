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
  constructor({ paymentRepo, invoiceRepo, txManager, eventBus }) {
    this.paymentRepo = paymentRepo;
    this.invoiceRepo = invoiceRepo;
    this.txManager = txManager;
    this.eventBus = eventBus;
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
      const db = this.invoiceRepo.col.client.db();
      const customer = await db.collection('customers').findOne({ userId: actor._id });
      if (!customer || customer._id.toString() !== invoice.customerId.toString()) {
        throw new ForbiddenError('You can only access your own invoices');
      }
    }
  }
}
