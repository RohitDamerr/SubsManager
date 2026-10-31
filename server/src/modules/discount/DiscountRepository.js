// DiscountRepository — discounts + redemptions collections.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { containsText } from '../../core/Search.js';

export class DiscountRepository extends BaseRepository {
  constructor(db) {
    super(db, 'discounts');
    this.redemptions = db.collection('discountRedemptions');
  }

  async list({ isActive, limit = 50, q } = {}) {
    const filter = {};
    if (q?.trim()) filter.name = containsText(q);
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    return this.col.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      ...payload,
      productIds: (payload.productIds || []).map((p) => new ObjectId(p)),
      usedCount: 0,
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  async update(id, update, options = {}) {
    if (update.productIds) {
      update.productIds = update.productIds.map((p) => new ObjectId(p));
    }
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }

  /** Load all active discounts valid on the given date — one query, no N+1. */
  async findActiveOnDate(date = new Date()) {
    return this.col.find({
      isActive: true,
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).toArray();
  }

  /**
   * Atomically claim one usage of a discount inside a transaction.
   * Returns the updated document or null if the limit was reached.
   */
  async claimUsage(discountId, session) {
    return this.col.findOneAndUpdate(
      {
        _id: new ObjectId(discountId),
        isActive: true,
        $expr: {
          $or: [
            { $eq: ['$usageLimit', null] },
            { $lt: ['$usedCount', '$usageLimit'] },
          ],
        },
      },
      { $inc: { usedCount: 1 }, $set: { updatedAt: new Date() } },
      { session, returnDocument: 'after' }
    );
  }

  /** Release a claimed usage (on invoice cancel). */
  async releaseUsage(discountId, session) {
    return this.col.updateOne(
      { _id: new ObjectId(discountId) },
      { $inc: { usedCount: -1 }, $set: { updatedAt: new Date() } },
      { session }
    );
  }

  async addRedemption(redemption, session) {
    return this.redemptions.insertOne(
      { ...redemption, createdAt: new Date() },
      { session }
    );
  }

  async removeRedemption(discountId, invoiceId, session) {
    return this.redemptions.deleteOne(
      { discountId: new ObjectId(discountId), invoiceId: new ObjectId(invoiceId) },
      { session }
    );
  }

  async findRedemptionsByInvoice(invoiceId) {
    return this.redemptions.find({ invoiceId: new ObjectId(invoiceId) }).toArray();
  }
}
