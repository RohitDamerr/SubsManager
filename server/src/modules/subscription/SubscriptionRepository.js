// SubscriptionRepository — subscriptions with lines embedded.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { keysetFilter } from '../../core/Pagination.js';

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
  async listWithPlanName({ limit = 20, cursor, status, customerId } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = new ObjectId(customerId);

    const keyset = keysetFilter(cursor, 'createdAt');
    if (keyset) Object.assign(filter, keyset);

    return this.col.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $addFields: { planName: { $arrayElemAt: ['$plan.name', 0] } } },
      { $project: { plan: 0 } },
    ]).toArray();
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

  /** Close autoClose subscriptions past their expiryDate (nightly job). */
  async autoCloseExpired() {
    return this.col.updateMany(
      { status: 'ACTIVE', expiryDate: { $lt: new Date() } },
      { $set: { status: 'CLOSED', nextInvoiceDate: null, updatedAt: new Date() } }
    );
  }
}
