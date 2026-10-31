// CounterService — gapless document numbers via atomic $inc on a counters collection.
// Produces formatted numbers like SUB-000123.
import { getDb } from '../../config/mongo.js';

export class CounterService {
  constructor() {
    this.col = null;
  }

  _col() {
    if (!this.col) this.col = getDb().collection('counters');
    return this.col;
  }

  /**
   * Atomically get the next sequence number for a counter key.
   * @param {string} key - e.g. 'subscription', 'invoice'
   * @param {import('mongodb').ClientSession} [session]
   * @returns {Promise<number>}
   */
  async next(key, session) {
    const result = await this._col().findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after', session }
    );
    return result.seq;
  }

  /**
   * Get a formatted document number.
   * @param {string} prefix - e.g. 'SUB', 'INV'
   * @param {number} seq
   * @param {number} [pad] - zero-padding width
   * @returns {string}
   */
  format(prefix, seq, pad = 6) {
    return `${prefix}-${String(seq).padStart(pad, '0')}`;
  }

  /**
   * Convenience: get next formatted number.
   */
  async nextFormatted(prefix, key, session) {
    const seq = await this.next(key, session);
    return this.format(prefix, seq);
  }
}
