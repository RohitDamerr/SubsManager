// TaxRepository — taxes collection access.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';

export class TaxRepository extends BaseRepository {
  constructor(db) { super(db, 'taxes'); }

  async list({ isActive } = {}) {
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive;
    return this.col.find(filter).sort({ name: 1 }).toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      name: payload.name,
      ratePercent: payload.ratePercent,
      isInclusive: payload.isInclusive ?? false,
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  async update(id, update, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }

  /** Bulk load taxes by ids — one $in query, no N+1. */
  async findManyByIds(ids, options = {}) {
    return super.findManyByIds(ids, options);
  }
}
