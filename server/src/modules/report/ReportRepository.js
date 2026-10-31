// ReportRepository — read-only aggregations, all hitting indexes.
import { ObjectId } from 'mongodb';

export class ReportRepository {
  constructor(db) {
    this.db = db;
    this.subscriptions = db.collection('subscriptions');
    this.invoices = db.collection('invoices');
    this.payments = db.collection('payments');
  }

  async activeSubscriptions() {
    return this.subscriptions.countDocuments({ status: 'ACTIVE' });
  }

  /** Revenue received in a period — served by the paidOn index. */
  async revenueReceived(from, to) {
    const match = { paidOn: { $gte: from, $lte: to } };
    const result = await this.payments.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray();
    return result[0]?.total || 0;
  }

  /** Still owed — sum (total - amountPaid) over confirmed invoices (partial index). */
  async outstanding() {
    const result = await this.invoices.aggregate([
      { $match: { status: 'CONFIRMED' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$amountPaid'] } } } },
    ]).toArray();
    return result[0]?.total || 0;
  }

  /** Count of overdue invoices — same filter as the list, served by the dueDate partial index. */
  async overdueCount() {
    return this.invoices.countDocuments({ status: 'CONFIRMED', dueDate: { $lt: new Date() } });
  }

  /** Overdue invoices with customer details. */
  async overdue({ limit = 50 } = {}) {
    const today = new Date();
    const rows = await this.invoices.aggregate([
      { $match: { status: 'CONFIRMED', dueDate: { $lt: today } } },
      { $sort: { dueDate: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
          pipeline: [{ $project: { companyName: 1 } }],
        },
      },
      // Prefer the snapshot on the invoice; fall back to the customer's company name.
      { $addFields: { customerName: { $ifNull: ['$customerName', { $arrayElemAt: ['$customer.companyName', 0] }] } } },
      { $project: { customer: 0 } },
    ]).toArray();

    // Days late computed in code.
    return rows.map((r) => ({
      ...r,
      daysLate: Math.floor((today - r.dueDate) / (1000 * 60 * 60 * 24)),
    }));
  }

  /** MRR — one $group summing monthlyAmount over active subscriptions. */
  async mrr() {
    const result = await this.subscriptions.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: null, total: { $sum: '$monthlyAmount' } } },
    ]).toArray();
    return result[0]?.total || 0;
  }

  /** Revenue time series grouped by month. */
  async revenueSeries(from, to, groupBy = 'month') {
    const fmt = groupBy === 'day'
      ? { $dateToString: { format: '%Y-%m-%d', date: '$paidOn' } }
      : { $dateToString: { format: '%Y-%m', date: '$paidOn' } };

    return this.payments.aggregate([
      { $match: { paidOn: { $gte: from, $lte: to } } },
      { $group: { _id: fmt, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
      { $project: { period: '$_id', total: 1, _id: 0 } },
    ]).toArray();
  }
}
