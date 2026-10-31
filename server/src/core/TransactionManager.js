// Wraps multi-document writes in a MongoDB transaction.
// Call run(fn) and receive the active session as the argument.

export class TransactionManager {
  /**
   * @param {import('mongodb').MongoClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {(session: import('mongodb').ClientSession) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async run(fn) {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => fn(session), {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' },
      });
    } finally {
      await session.endSession();
    }
  }
}
