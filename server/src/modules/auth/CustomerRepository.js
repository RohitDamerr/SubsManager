// CustomerRepository — customers collection.  Each customer references a userId.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { containsText } from '../../core/Search.js';

export class CustomerRepository extends BaseRepository {
  constructor(db) { super(db, 'customers'); }

  async findByUserId(userId, options = {}) {
    return this.col.findOne({ userId: new ObjectId(userId) }, options);
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      userId: new ObjectId(payload.userId),
      companyName: payload.companyName || '',
      phone: payload.phone || '',
      billingAddress: payload.billingAddress || '',
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  /** Customers joined with their user's name/email — one aggregation, lookup after $limit. */
  async listWithUser({ q, limit = 100 } = {}) {
    const pipeline = [
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, email: 1, isActive: 1 } }] } },
      { $addFields: { user: { $arrayElemAt: ['$user', 0] } } },
    ];
    if (q) {
      const rx = containsText(q);
      pipeline.push({ $match: { $or: [{ companyName: rx }, { 'user.name': rx }, { 'user.email': rx }] } });
    }
    pipeline.push({ $limit: limit }, {
      $project: { companyName: 1, phone: 1, createdAt: 1, name: '$user.name', email: '$user.email', isActive: '$user.isActive' },
    });
    return this.col.aggregate(pipeline).toArray();
  }

  /** Ids of customers whose company, name or email contains q — lets lists search "by customer". */
  async findIdsMatching(q, limit = 500) {
    const rx = containsText(q);
    const rows = await this.col.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, email: 1 } }] } },
      { $match: { $or: [{ companyName: rx }, { 'user.name': rx }, { 'user.email': rx }] } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]).toArray();
    return rows.map((r) => r._id);
  }

  async updateByUserId(userId, update, options = {}) {
    return this.col.updateOne(
      { userId: new ObjectId(userId) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }
}
