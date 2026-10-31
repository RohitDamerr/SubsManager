// TaxRepository — taxes collection access.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { containsText } from '../../core/Search.js';

export class TaxRepository extends BaseRepository {
  constructor(db) { super(db, 'taxes'); }

  async list({ isActive, q } = {}) {
    const filter = {};
    if (q?.trim()) filter.name = containsText(q);
    if (isActive !== undefined) filter.isActive = isActive === true || isActive === 'true'; // query strings are text
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
