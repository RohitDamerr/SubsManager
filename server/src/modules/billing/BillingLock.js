// BillingLock — distributed lock via a locks collection with a TTL index.
// A duplicate key error means another run is active; the TTL frees a crashed lock.
import { ObjectId } from 'mongodb';

export class BillingLock {
  /**
   * @param {import('mongodb').Db} db
   */
  constructor(db) {
    this.col = db.collection('locks');
  }

  /**
   * Try to acquire the billing lock. Returns true if acquired.
   * @param {number} ttlMinutes
   * @returns {Promise<boolean>}
   */
  async acquire(ttlMinutes = 30) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    try {
      await this.col.insertOne({ _id: 'billing', expiresAt });
      return true;
    } catch (err) {
      if (err?.code === 11000) {
        // Another run is active. Check if the lock is expired.
        const existing = await this.col.findOne({ _id: 'billing' });
        if (existing && existing.expiresAt < new Date()) {
          // Stale lock — try to replace it.
          const result = await this.col.replaceOne(
            { _id: 'billing', expiresAt: existing.expiresAt },
            { _id: 'billing', expiresAt }
          );
          return result.modifiedCount > 0;
        }
        return false;
      }
      throw err;
    }
  }

  async release() {
    await this.col.deleteOne({ _id: 'billing' });
  }
}
