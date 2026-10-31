// Shared MongoDB client — one connection per process, reused by all repositories.
import { MongoClient } from 'mongodb';
import { config } from './env.js';

let client = null;
let db = null;

export async function connect() {
  if (client) return { client, db };

  client = new MongoClient(config.mongo.uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();
  db = client.db();

  // Ping to fail fast on misconfiguration.
  await db.command({ ping: 1 });
  console.log('[mongo] connected to', config.mongo.uri);

  return { client, db };
}

export function getDb() {
  if (!db) throw new Error('Database not initialised — call connect() first.');
  return db;
}

export function getClient() {
  if (!client) throw new Error('Client not initialised — call connect() first.');
  return client;
}

export async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[mongo] disconnected');
  }
}
