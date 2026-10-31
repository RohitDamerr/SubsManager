// PaymentRepository — payments collection. Referenced (queried by date for reports).
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { keysetFilter } from '../../core/Pagination.js';

export class PaymentRepository extends BaseRepository {
  constructor(db) { super(db, 'payments'); }

  /**
   * Payments register, newest first.  Filters hit the paidOn / customerId+paidOn indexes;
   * invoice number + customer name are joined after $limit (only for the rows on the page).
   */
  async list({ limit = 20, cursor, from, to, method, customerId } = {}) {
    const filter = {};
    if (customerId) filter.customerId = this.toObjectId(customerId);
    if (method) filter.method = method;
    if (from || to) {
      filter.paidOn = {};
      if (from) filter.paidOn.$gte = new Date(from);
      if (to) filter.paidOn.$lte = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1);
    }
    const keyset = keysetFilter(cursor, 'paidOn');
    const match = keyset ? { $and: [filter, keyset] } : filter;

    return this.col.aggregate([
      { $match: match },
      { $sort: { paidOn: -1, _id: -1 } },
      { $limit: limit + 1 },
      { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'invoice', pipeline: [{ $project: { number: 1, customerName: 1 } }] } },
      { $addFields: { invoiceNumber: { $arrayElemAt: ['$invoice.number', 0] }, customerName: { $arrayElemAt: ['$invoice.customerName', 0] } } },
      { $project: { invoice: 0 } },
    ]).toArray();
  }

  /** Total collected for the same filters (one $group) — shown above the register. */
  async total({ from, to, method, customerId } = {}) {
    const filter = {};
    if (customerId) filter.customerId = this.toObjectId(customerId);
    if (method) filter.method = method;
    if (from || to) {
      filter.paidOn = {};
      if (from) filter.paidOn.$gte = new Date(from);
      if (to) filter.paidOn.$lte = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1);
    }
    const [row] = await this.col.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();
    return { total: row?.total || 0, count: row?.count || 0 };
  }

  async findByInvoice(invoiceId) {
    return this.col.find({ invoiceId: new ObjectId(invoiceId) }).sort({ paidOn: -1 }).toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      invoiceId: new ObjectId(payload.invoiceId),
      customerId: new ObjectId(payload.customerId),
      method: payload.method,
      amount: payload.amount,
      paidOn: payload.paidOn || now,
      note: payload.note || '',
      recordedBy: payload.recordedBy ? new ObjectId(payload.recordedBy) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }
}
