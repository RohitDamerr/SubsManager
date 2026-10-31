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

  /** Generate printable HTML (customer details + lines + totals).  All text is escaped. */
  buildPrintHTML(invoice) {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (p) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const rows = (invoice.lines || []).map((l) => `
      <tr>
        <td>${esc(l.description)}</td>
        <td class="n">${l.quantity || 0}</td>
        <td class="n">${money(l.unitPrice)}</td>
        <td class="n">${l.discountAmount ? '−' + money(l.discountAmount) : '—'}</td>
        <td class="n">${money(l.taxAmount)} <small>(${l.taxRate || 0}%)</small></td>
        <td class="n">${money(l.lineTotal)}</td>
      </tr>`).join('');
    const balance = invoice.status === 'CANCELLED' ? 0 : invoice.total - invoice.amountPaid;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(invoice.number || 'Draft')}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #111827; font-size: 14px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .brand { font-size: 22px; font-weight: 700; color: #4f46e5; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  .muted { color: #6b7280; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-weight: 600; font-size: 12px; }
  .parties { display: flex; gap: 48px; margin-bottom: 24px; }
  .parties div { min-width: 200px; }
  .label { text-transform: uppercase; font-size: 11px; letter-spacing: .05em; color: #6b7280; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #f9fafb; font-size: 12px; text-transform: uppercase; color: #6b7280; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin: 20px 0 0 auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #111827; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 16px; }
  @media print { body { margin: 16mm; } }
</style></head>
<body>
  <div class="top">
    <div><div class="brand">Brightloop Software</div><div class="muted">Subscription billing</div></div>
    <div style="text-align:right">
      <h1>Invoice ${esc(invoice.number || '(draft)')}</h1>
      <span class="status">${esc(invoice.status)}</span>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="label">Bill to</div>
      <strong>${esc(invoice.customerName || 'Customer')}</strong><br>
      ${invoice.customerEmail ? esc(invoice.customerEmail) + '<br>' : ''}
      ${invoice.billingAddress ? esc(invoice.billingAddress).replace(/\n/g, '<br>') : ''}
    </div>
    <div>
      <div class="label">Details</div>
      Issued: ${date(invoice.issueDate)}<br>
      Due: ${date(invoice.dueDate)}<br>
      Period: ${date(invoice.periodStart)} – ${date(invoice.periodEnd)}
      ${invoice.subscriptionNumber ? '<br>Subscription: ' + esc(invoice.subscriptionNumber) : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Discount</th><th class="n">Tax</th><th class="n">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>
    <div><span>Discount</span><span>−${money(invoice.discountTotal)}</span></div>
    <div><span>Tax</span><span>${money(invoice.taxTotal)}</span></div>
    <div class="grand"><span>Total</span><span>${money(invoice.total)}</span></div>
    <div><span>Paid</span><span>${money(invoice.amountPaid)}</span></div>
    <div><strong>Balance due</strong><strong>${money(balance)}</strong></div>
  </div>
  <script>window.onload = () => window.print();</script>
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
