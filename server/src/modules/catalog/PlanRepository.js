// PlanRepository — plans collection access.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { encodeCursor } from '../../core/Pagination.js';

export class PlanRepository extends BaseRepository {
  constructor(db) { super(db, 'plans'); }

  async list({ limit, cursor, q } = {}) {
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };

    // Use createdAt ascending for keyset — plans are rarely paginated heavily.
    const rows = await this.col.find(filter)
      .sort({ createdAt: 1, _id: -1 })
      .limit(limit + 1)
      .toArray();
    return rows;
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      ...payload,
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
}
