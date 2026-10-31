// CustomerRepository — customers collection.  Each customer references a userId.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';

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

  async updateByUserId(userId, update, options = {}) {
    return this.col.updateOne(
      { userId: new ObjectId(userId) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }
}
