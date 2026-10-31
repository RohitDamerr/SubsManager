// UserRepository — users collection access.  Email is stored lowercased.
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../core/BaseRepository.js';
import { containsText } from '../../core/Search.js';

export class UserRepository extends BaseRepository {
  constructor(db) { super(db, 'users'); }

  async findByEmail(email) {
    return this.col.findOne({ email: email.toLowerCase() });
  }

  async create(payload, options = {}) {
    const now = new Date();
    const doc = {
      email: payload.email.toLowerCase(),
      passwordHash: payload.passwordHash,
      role: payload.role || 'CUSTOMER',
      name: payload.name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    if (payload.resetToken) doc.resetToken = payload.resetToken;
    const result = await this.col.insertOne(doc, options);
    return { ...doc, _id: result.insertedId };
  }

  async listByRoles(roles, q) {
    const filter = { role: { $in: roles } };
    if (q?.trim()) filter.$or = [{ name: containsText(q) }, { email: containsText(q) }];
    return this.col.find(filter, { projection: { passwordHash: 0, resetToken: 0 } })
      .sort({ createdAt: -1 }).toArray();
  }

  async updatePassword(id, passwordHash, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { passwordHash, updatedAt: new Date() } },
      options
    );
  }

  async setResetToken(id, tokenDoc, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { resetToken: tokenDoc, updatedAt: new Date() } },
      options
    );
  }

  async findByResetTokenHash(hash) {
    return this.col.findOne({
      'resetToken.hash': hash,
      'resetToken.expiresAt': { $gt: new Date() },
      'resetToken.usedAt': { $exists: false },
    });
  }

  async markTokenUsed(id, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { 'resetToken.usedAt': new Date(), updatedAt: new Date() } },
      options
    );
  }

  async deactivate(id, options = {}) {
    return this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: false, updatedAt: new Date() } },
      options
    );
  }
}
