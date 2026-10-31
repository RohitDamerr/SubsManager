// Wraps multi-document writes in a MongoDB transaction.
// Call run(fn) and receive the active session as the argument.
// On a standalone mongod (no replica set) transactions are unsupported, so fn
// runs directly with session = undefined — writes still happen, just not atomically.

export class TransactionManager {
  /**
   * @param {import('mongodb').MongoClient} client
   */
  constructor(client) {
    this.client = client;
    this.supportsTransactions = null; // detected lazily on first run()
  }

  async detectSupport() {
    if (this.supportsTransactions === null) {
      const hello = await this.client.db('admin').command({ hello: 1 });
      // Replica set members report setName; mongos reports msg 'isdbgrid'.
      this.supportsTransactions = Boolean(hello.setName) || hello.msg === 'isdbgrid';
      if (!this.supportsTransactions) {
        console.warn('[tx] standalone MongoDB detected — running without transactions (dev only).');
      }
    }
    return this.supportsTransactions;
  }

  /**
   * @param {(session: import('mongodb').ClientSession | undefined) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async run(fn) {
    if (!(await this.detectSupport())) return fn(undefined);

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
