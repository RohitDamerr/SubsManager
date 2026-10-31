// QuotationTemplateRepository — templates with lines embedded.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';

export class QuotationTemplateRepository extends BaseRepository {
  constructor(db) { super(db, 'quotationTemplates'); }

  async list({ q } = {}) {
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };
    return this.col.find(filter).sort({ createdAt: -1 }).toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      name: payload.name,
      planId: new ObjectId(payload.planId),
      validityDays: payload.validityDays,
      lines: payload.lines.map((l) => ({
        productId: new ObjectId(l.productId),
        variantId: l.variantId ? new ObjectId(l.variantId) : undefined,
        quantity: l.quantity,
      })),
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  async update(id, update, options = {}) {
    if (update.planId) update.planId = new ObjectId(update.planId);
    if (update.lines) {
      update.lines = update.lines.map((l) => ({
        productId: new ObjectId(l.productId),
        variantId: l.variantId ? new ObjectId(l.variantId) : undefined,
        quantity: l.quantity,
      }));
    }
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      options
    );
  }
}
