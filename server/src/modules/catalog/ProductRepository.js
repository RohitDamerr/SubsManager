// ProductRepository — products with variants embedded.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { containsText } from '../../core/Search.js';
import { keysetFilterAsc } from '../../core/Pagination.js';

export class ProductRepository extends BaseRepository {
  constructor(db) { super(db, 'products'); }

  async list({ limit, cursor, q, isActive } = {}) {
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (q?.trim()) filter.name = containsText(q);

    const keyset = keysetFilterAsc(cursor, 'name');
    if (keyset) Object.assign(filter, keyset);

    return this.col.find(filter)
      .sort({ name: 1, _id: 1 })
      .limit(limit + 1)
      .toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      ...payload,
      taxIds: (payload.taxIds || []).map((id) => new ObjectId(id)),
      variants: payload.variants || [],
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  async addVariant(id, variant, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: { variants: { _id: new ObjectId(), ...variant } },
        $set: { updatedAt: new Date() },
      },
      options
    );
  }

  async update(id, update, options = {}) {
    if (update.taxIds) {
      update.taxIds = update.taxIds.map((t) => new ObjectId(t));
    }
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }
}
