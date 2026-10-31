// InvoiceService — invoice actions (confirm, cancel, send, print).
import { ObjectId } from 'mongodb';
import {
  NotFoundError, ValidationError, ForbiddenError, ConflictError,
} from '../../core/AppError.js';
import { CounterService } from '../subscription/CounterService.js';

export class InvoiceService {
  /**
   * @param {{ invoiceRepo, subscriptionRepo, discountRepo, txManager, eventBus, invoiceStateMachine, mailer }} deps
   */
  constructor({ invoiceRepo, subscriptionRepo, discountRepo, customerRepo, userRepo, txManager, eventBus, invoiceStateMachine, mailer }) {
    this.invoiceRepo = invoiceRepo;
    this.subscriptionRepo = subscriptionRepo;
    this.discountRepo = discountRepo;
    this.customerRepo = customerRepo;
    this.userRepo = userRepo;
    this.txManager = txManager;
    this.eventBus = eventBus;
    this.sm = invoiceStateMachine;
    this.mailer = mailer;
    this.counter = new CounterService();
  }

  async list(query, actor) {
    const limit = Number(query.limit) || 20;
    const filter = { ...query, limit };
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer) return { data: [], hasMore: false };
      filter.customerId = customer._id.toString();
      // Drafts are internal until staff confirm them.
      if (filter.status === 'DRAFT') return { data: [], hasMore: false };
      filter.excludeDraft = true;
    }
    const rows = await this.invoiceRepo.list(filter);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore };
  }

  async getById(id, actor) {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);
    // Add payments and the parent subscription number (fixed small number of queries).
    const db = this.invoiceRepo.col.client.db();
    const [payments, sub] = await Promise.all([
      db.collection('payments').find({ invoiceId: new ObjectId(id) }).sort({ paidOn: -1 }).toArray(),
      this.subscriptionRepo.findById(invoice.subscriptionId, { projection: { number: 1 } }),
    ]);
    return { ...invoice, payments, subscriptionNumber: sub?.number || null };
  }

  /** Confirm: DRAFT → CONFIRMED, assign final invoice number. */
  async confirm(id, actor) {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);

    this.sm.assertCan(invoice.status, 'CONFIRMED');

    const number = await this.counter.nextFormatted('INV', 'invoice');
    const result = await this.invoiceRepo.transition(id, 'DRAFT', { number, status: 'CONFIRMED' });
    if (result.matchedCount === 0) {
      throw new ValidationError('Invoice state changed concurrently');
    }

    const updated = await this.invoiceRepo.findById(id);
    this.eventBus.emit('invoice.confirmed', { invoiceId: id });
    return updated;
  }

  /**
   * Cancel: blocked if payments exist.
   * In one transaction: set status CANCELLED + billable false, release discount usage, delete redemptions,
   * and roll back nextInvoiceDate if this was the latest period.
   */
  async cancel(id, actor) {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);

    if (invoice.amountPaid > 0) {
      throw new ValidationError('Cannot cancel an invoice with payments');
    }

    this.sm.assertCan(invoice.status, 'CANCELLED');

    return this.txManager.run(async (session) => {
      // Release discount usage and remove redemptions.
      const redemptions = await this.discountRepo.redemptions.find({ invoiceId: new ObjectId(id) }, { session }).toArray();
      for (const r of redemptions) {
        await this.discountRepo.releaseUsage(r.discountId, session);
        await this.discountRepo.removeRedemption(r.discountId, id, session);
      }

      // Set status CANCELLED + billable false so period can be re-billed.
      await this.invoiceRepo.transition(id, invoice.status, { status: 'CANCELLED', billable: false }, { session });

      // Roll back nextInvoiceDate if this was the latest billable period.
      const sub = await this.subscriptionRepo.findById(invoice.subscriptionId, { session });
      if (sub && sub.lastBilledPeriodEnd?.getTime() === invoice.periodEnd.getTime()) {
        await this.subscriptionRepo.update(invoice.subscriptionId, {
          nextInvoiceDate: invoice.periodStart,
          lastBilledPeriodEnd: null,
        }, { session });
      }

      return this.invoiceRepo.findById(id, { session });
    });
  }

  /** Send: email the invoice to the customer. */
  async send(id, actor) {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new NotFoundError('Invoice');
    await this.assertCanAccess(invoice, actor);

    if (invoice.status === 'DRAFT') throw new ValidationError('Confirm the invoice before sending');

    const customer = await this.customerRepo.findById(invoice.customerId);
    const user = customer ? await this.userRepo.findById(customer.userId) : null;
    if (!user) throw new NotFoundError('Customer user');

    if (this.mailer) {
      await this.mailer.send({
        to: user.email,
        subject: `Invoice ${invoice.number || ''} — Brightloop`,
        text: `Your invoice for ${invoice.periodStart?.toISOString?.()} to ${invoice.periodEnd?.toISOString?.()} is ready. Total: ${invoice.total}`,
      });
    }

    await this.invoiceRepo.update(id, { sentAt: new Date() });
    this.eventBus.emit('invoice.sent', { invoiceId: id });
    return this.invoiceRepo.findById(id);
  }

  /** Generate printable HTML. */
  buildPrintHTML(invoice) {
    const rows = (invoice.lines || []).map((l) => `
      <tr>
        <td>${l.description || ''}</td>
        <td style="text-align:right">${l.quantity || 0}</td>
        <td style="text-align:right">${(l.unitPrice / 100).toFixed(2)}</td>
        <td style="text-align:right">${(l.discountAmount / 100).toFixed(2)}</td>
        <td style="text-align:right">${(l.taxAmount / 100).toFixed(2)}</td>
        <td style="text-align:right">${(l.lineTotal / 100).toFixed(2)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.number || ''}</title>
<style>
  body { font-family: sans-serif; margin: 40px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 8px 12px; border-bottom: 1px solid #ddd; }
  th { text-align: left; background: #f5f5f5; }
  .totals { margin-top: 20px; float: right; }
  .totals div { margin: 4px 0; display: flex; justify-content: space-between; width: 250px; }
</style></head>
<body>
  <h1>Invoice ${invoice.number || ''}</h1>
  <p>Date: ${invoice.issueDate?.toISOString?.().slice(0, 10) || ''}</p>
  <p>Due: ${invoice.dueDate?.toISOString?.().slice(0, 10) || ''}</p>
  <p>Status: ${invoice.status}</p>
  <table>
    <thead><tr>
      <th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal:</span><span>${(invoice.subtotal / 100).toFixed(2)}</span></div>
    <div><span>Discount:</span><span>-${(invoice.discountTotal / 100).toFixed(2)}</span></div>
    <div><span>Tax:</span><span>${(invoice.taxTotal / 100).toFixed(2)}</span></div>
    <div><strong><span>Total:</span><span>${(invoice.total / 100).toFixed(2)}</span></strong></div>
    <div><span>Paid:</span><span>${(invoice.amountPaid / 100).toFixed(2)}</span></div>
  </div>
</body></html>`;
  }

  async assertCanAccess(invoice, actor) {
    if (actor.role === 'CUSTOMER') {
      const customer = await this.customerRepo.findByUserId(actor._id);
      if (!customer || customer._id.toString() !== invoice.customerId.toString()) {
        throw new ForbiddenError('You can only access your own invoices');
      }
      if (invoice.status === 'DRAFT') throw new NotFoundError('Invoice');
    }
  }
}
