// Server bootstrap — connect to Mongo, ensure indexes, build container, start scheduler, listen.
import { connect } from './config/mongo.js';
import { ensureIndexes } from '../db/ensureIndexes.js';
import { buildContainer } from './config/container.js';
import { createApp } from './app.js';
import { config } from './config/env.js';

async function main() {
  // Connect to MongoDB first — everything depends on it.
  await connect();

  // Ensure indexes (idempotent — safe on every startup).
  await ensureIndexes();

  // Wire dependencies and build the Express app.
  const { routers, scheduler, eventBus, mailer } = buildContainer();

  // Init mailer (lazy, non-blocking if SMTP is unset).
  mailer.init().catch((err) => console.warn('[server] mailer init skipped:', err.message));

  // Start the cron scheduler.
  scheduler.start();
  console.log('[server] billing scheduler started');

  const app = createApp(routers);

  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
