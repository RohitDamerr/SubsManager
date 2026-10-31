// PaymentRepository — payments collection. Referenced (queried by date for reports).
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';

export class PaymentRepository extends BaseRepository {
  constructor(db) { super(db, 'payments'); }

  async findByInvoice(invoiceId) {
    return this.col.find({ invoiceId: new ObjectId(invoiceId) }).sort({ paidOn: -1 }).toArray();
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      invoiceId: new ObjectId(payload.invoiceId),
      customerId: new ObjectId(payload.customerId),
      method: payload.method,
      amount: payload.amount,
      paidOn: payload.paidOn || now,
      note: payload.note || '',
      recordedBy: payload.recordedBy ? new ObjectId(payload.recordedBy) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }
}
