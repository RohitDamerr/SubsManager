// InvoiceRepository — invoices with lines embedded.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { keysetFilter } from '../../core/Pagination.js';
import { containsText, numberPrefix } from '../../core/Search.js';

export class InvoiceRepository extends BaseRepository {
  constructor(db) { super(db, 'invoices'); }

  async list({ limit = 20, cursor, status, customerId, overdue, excludeDraft, q, qCustomerIds = [], from, to } = {}) {
    const filter = {};
    if (q?.trim()) {
      const byNumber = numberPrefix(q, 'INV');
      filter.$or = [
        ...(byNumber ? [{ number: byNumber }] : []),
        { customerId: { $in: qCustomerIds } },
        { customerName: containsText(q) },
      ];
    }
    if (from || to) {
      filter.issueDate = {};
      if (from) filter.issueDate.$gte = new Date(from);
      if (to) filter.issueDate.$lte = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1); // inclusive day
    }
    if (status) filter.status = status;
    else if (excludeDraft) filter.status = { $ne: 'DRAFT' };
    if (customerId) filter.customerId = this.toObjectId(customerId);
    if (overdue === 'true' || overdue === true) {
      filter.status = 'CONFIRMED';
      filter.dueDate = { $lt: new Date() };
    }

    // The keyset $or must be ANDed with the date range, not merged over it.
    const keyset = keysetFilter(cursor, 'issueDate');
    const query = keyset ? { $and: [filter, keyset] } : filter;

    return this.col.find(query, { projection: { lines: 0 } })
      .sort({ issueDate: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
  }

  async insertMany(invoices, options = {}) {
    if (!invoices.length) return;
    const now = new Date();
    const docs = invoices.map((inv) => ({
      ...inv,
      subscriptionId: new ObjectId(inv.subscriptionId),
      customerId: new ObjectId(inv.customerId),
      billable: inv.billable ?? true,
      createdAt: now,
      updatedAt: now,
    }));
    return this.col.insertMany(docs, options);
  }

  async insertOne(invoice, options = {}) {
    const now = new Date();
    const doc = {
      ...invoice,
      subscriptionId: new ObjectId(invoice.subscriptionId),
      customerId: new ObjectId(invoice.customerId),
      billable: invoice.billable ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  /**
   * Conditional status update — only succeeds if current status matches `from`.
   */
  async transition(id, from, set, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id), status: from },
      { $set: { ...set, updatedAt: new Date() } },
      options
    );
  }

  async update(id, update, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }

  /**
   * Guarded payment pipeline update:
   * Only applies if status is CONFIRMED and adding `amount` won't exceed total.
   * Sets status to PAID when amountPaid reaches total.
   */
  async applyPayment(id, amount, options = {}) {
    return this.col.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        status: 'CONFIRMED',
        $expr: { $lte: [{ $add: ['$amountPaid', amount] }, '$total'] },
      },
      [
        {
          $set: {
            amountPaid: { $add: ['$amountPaid', amount] },
            status: {
              $cond: {
                if: { $gte: [{ $add: ['$amountPaid', amount] }, '$total'] },
                then: 'PAID',
                else: '$status',
              },
            },
            updatedAt: new Date(),
          },
        },
      ],
      { ...options, returnDocument: 'after' }
    );
  }

  async findBySubscription(subscriptionId) {
    return this.col.find({ subscriptionId: new ObjectId(subscriptionId) })
      .sort({ issueDate: -1 }).toArray();
  }

  async findByPeriod(subscriptionId, periodStart, options = {}) {
    return this.col.findOne(
      { subscriptionId: new ObjectId(subscriptionId), periodStart, billable: true },
      options
    );
  }

  /**
   * Update overdue stats via aggregation.  Returns overdue invoices with customer details.
   * (lookup AFTER limit — no N+1).
   */
  async findOverdue({ limit = 50 } = {}) {
    return this.col.aggregate([
      { $match: { status: 'CONFIRMED', dueDate: { $lt: new Date() } } },
      { $sort: { dueDate: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
          pipeline: [{ $project: { companyName: 1, userId: 1 } }],
        },
      },
      { $addFields: { customerName: { $arrayElemAt: ['$customer.companyName', 0] } } },
      { $project: { customer: 0 } },
    ]).toArray();
  }
}
