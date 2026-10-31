// SubscriptionRepository — subscriptions with lines embedded.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { keysetFilter } from '../../core/Pagination.js';

/** "12" or "sub-12" → prefix match on the unique number index (e.g. ^SUB-000012). */
export function numberPrefix(q, prefix) {
  const digits = String(q).toUpperCase().replace(new RegExp(`^${prefix}-?`), '').replace(/D/g, '');
  if (!digits) return { $regex: `^${prefix}-` };
  return { $regex: `^${prefix}-0*${digits}` };
}

// customerId → customers → users, yielding customerName / customerEmail. Use after $limit.
function customerNameStages() {
  return [
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
        pipeline: [
          { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, email: 1 } }] } },
          { $project: { companyName: 1, user: { $arrayElemAt: ['$user', 0] } } },
        ],
      },
    },
    { $addFields: { customer: { $arrayElemAt: ['$customer', 0] } } },
    {
      $addFields: {
        customerName: {
          $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$customer.companyName', ''] } }, 0] }, '$customer.companyName', '$customer.user.name'],
        },
        customerEmail: '$customer.user.email',
      },
    },
    { $project: { customer: 0 } },
  ];
}

export class SubscriptionRepository extends BaseRepository {
  constructor(db) { super(db, 'subscriptions'); }

  async list({ limit = 20, cursor, status, customerId, q } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = new ObjectId(customerId);

    const keyset = keysetFilter(cursor, 'createdAt');
    if (keyset) Object.assign(filter, keyset);

    return this.col.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
  }

  /**
   * List with plan name via aggregation — $lookup placed AFTER $limit (no N+1).
   */
  async listWithPlanName({ limit = 20, cursor, status, customerId, q } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = this.toObjectId(customerId);
    if (q) filter.number = numberPrefix(q, 'SUB');

    const keyset = keysetFilter(cursor, 'createdAt');
    if (keyset) Object.assign(filter, keyset);

    return this.col.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: limit + 1 }, // one extra row tells the service whether there is a next page
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan',
          pipeline: [{ $project: { name: 1, billingPeriod: 1 } }],
        },
      },
      ...customerNameStages(),
      {
        $addFields: {
          planName: { $arrayElemAt: ['$plan.name', 0] },
          billingPeriod: { $arrayElemAt: ['$plan.billingPeriod', 0] },
        },
      },
      { $project: { plan: 0, lines: 0 } },
    ]).toArray();
  }

  /** Detail: subscription + plan + customer in one aggregation (lines are embedded). */
  async findDetail(id) {
    const [row] = await this.col.aggregate([
      { $match: { _id: this.toObjectId(id) } },
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan',
          pipeline: [{ $project: { name: 1, billingPeriod: 1, price: 1, allowPause: 1, allowEarlyClose: 1, allowRenew: 1, autoClose: 1 } }],
        },
      },
      { $addFields: { plan: { $arrayElemAt: ['$plan', 0] } } },
      ...customerNameStages(),
    ]).toArray();
    return row || null;
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      ...payload,
      planId: new ObjectId(payload.planId),
      customerId: new ObjectId(payload.customerId),
      lines: payload.lines || [],
      status: payload.status || 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  /**
   * Conditional update — only succeeds if current status matches `from`.
   * Prevents two concurrent transitions from both succeeding.
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

  /** Find due subscriptions for billing — uses the partial index on nextInvoiceDate. */
  async findDue(batchSize = 500) {
    return this.col.find({
      status: 'ACTIVE',
      nextInvoiceDate: { $lte: new Date() },
    })
      .sort({ nextInvoiceDate: 1 })
      .limit(batchSize)
      .toArray();
  }

  /** Bulk advance nextInvoiceDate and lastBilledPeriodEnd for processed subscriptions. */
  async bulkAdvance(updates, session) {
    if (!updates.length) return;
    const bulkOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: new ObjectId(u.id) },
        update: {
          $set: {
            nextInvoiceDate: u.nextInvoiceDate,
            lastBilledPeriodEnd: u.lastBilledPeriodEnd,
            updatedAt: new Date(),
          },
        },
      },
    }));
    return this.col.bulkWrite(bulkOps, { session });
  }

  /** Close subscriptions past their expiryDate whose plan has autoClose (nightly job). */
  async autoCloseExpired(autoClosePlanIds) {
    if (!autoClosePlanIds.length) return { modifiedCount: 0 };
    return this.col.updateMany(
      { status: { $in: ['ACTIVE', 'PAUSED'] }, planId: { $in: autoClosePlanIds }, expiryDate: { $lt: new Date() } },
      { $set: { status: 'CLOSED', nextInvoiceDate: null, closedReason: 'EXPIRED', updatedAt: new Date() } }
    );
  }

  /** Renewal — conditional on status so it can't race a transition; counts renewals. */
  async renew(id, status, set) {
    return this.col.updateOne(
      { _id: this.toObjectId(id), status },
      { $set: { ...set, updatedAt: new Date() }, $inc: { renewalCount: 1 } }
    );
  }
}
