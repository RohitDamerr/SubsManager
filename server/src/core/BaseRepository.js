// Base repository — holds a collection handle and provides shared read helpers.
// All id-based lookups go through here so ObjectId conversion is centralised.

import { ObjectId } from 'mongodb';
import { ValidationError } from './AppError.js';

export class BaseRepository {
  /**
   * @param {import('mongodb').Db} db
   * @param {string} collectionName
   */
  constructor(db, collectionName) {
    this.col = db.collection(collectionName);
  }

  /** Convert a string id to ObjectId, throwing on invalid input. */
  toObjectId(id) {
    if (id instanceof ObjectId) return id;
    if (!ObjectId.isValid(id)) {
      throw new ValidationError(`Invalid id: ${id}`);
    }
    return new ObjectId(id);
  }

  async findById(id, options = {}) {
    return this.col.findOne({ _id: this.toObjectId(id) }, options);
  }

  // One query for any number of ids — no N+1.
  async findManyByIds(ids, options = {}) {
    if (!ids?.length) return [];
    const objectIds = ids.map((i) => (i instanceof ObjectId ? i : new ObjectId(i)));
    return this.col.find({ _id: { $in: objectIds } }, options).toArray();
  }

  async exists(filter) {
    return (await this.col.countDocuments(filter, { limit: 1 })) > 0;
  }

  async count(filter = {}) {
    return this.col.countDocuments(filter);
  }

  /** Insert with automatic createdAt / updatedAt timestamps. */
  async insertOne(doc, options = {}) {
    const now = new Date();
    const full = { ...doc, createdAt: now, updatedAt: now };
    const result = await this.col.insertOne(full, options);
    return { ...full, _id: result.insertedId };
  }
}
