// ensureIndexes — idempotent; runs at every startup.
// Every createIndex call lives here so index design is in one place.
import { getDb } from '../src/config/mongo.js';

export async function ensureIndexes() {
  const db = getDb();

  // Users
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex(
    { 'resetToken.hash': 1 },
    { partialFilterExpression: { 'resetToken.hash': { $exists: true } } }
  );

  // Customers
  await db.collection('customers').createIndex({ userId: 1 }, { unique: true });

  // Products
  await db.collection('products').createIndex({ name: 1 });
  await db.collection('products').createIndex({ isActive: 1 });

  // Plans
  await db.collection('plans').createIndex({ name: 1 });

  // Taxes
  await db.collection('taxes').createIndex({ name: 1 });

  // Discounts
  await db.collection('discounts').createIndex(
    { startDate: 1, endDate: 1 },
    { partialFilterExpression: { isActive: true } }
  );
  await db.collection('discounts').createIndex({ productIds: 1 });

  // Discount redemptions
  await db.collection('discountRedemptions').createIndex(
    { discountId: 1, invoiceId: 1 },
    { unique: true }
  );

  // Quotation templates
  await db.collection('quotationTemplates').createIndex({ name: 1 });

  // Subscriptions
  // Billing-day lookup: covers only active subscriptions (tiny partial index).
  await db.collection('subscriptions').createIndex(
    { nextInvoiceDate: 1 },
    { partialFilterExpression: { status: 'ACTIVE' } }
  );
  await db.collection('subscriptions').createIndex({ number: 1 }, { unique: true });
  await db.collection('subscriptions').createIndex({ customerId: 1, status: 1, _id: -1 });

  // Invoices
  // No double billing: a cancelled invoice sets billable=false so its period can be billed again.
  await db.collection('invoices').createIndex(
    { subscriptionId: 1, periodStart: 1 },
    { unique: true, partialFilterExpression: { billable: true } }
  );
  await db.collection('invoices').createIndex({ number: 1 }, { unique: true });
  await db.collection('invoices').createIndex({ customerId: 1, issueDate: -1, _id: -1 });
  await db.collection('invoices').createIndex({ status: 1, issueDate: -1, _id: -1 });
  // Overdue list: only confirmed invoices.
  await db.collection('invoices').createIndex(
    { dueDate: 1 },
    { partialFilterExpression: { status: 'CONFIRMED' } }
  );
  await db.collection('invoices').createIndex({ subscriptionId: 1 });

  // Payments
  await db.collection('payments').createIndex({ invoiceId: 1 });
  await db.collection('payments').createIndex({ paidOn: 1 });
  await db.collection('payments').createIndex({ customerId: 1, paidOn: -1 });

  // Locks — TTL index frees a lock left behind by a crash.
  await db.collection('locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Counters — gapless document numbers.
  await db.collection('counters').createIndex({ _id: 1 });

  console.log('[db] indexes ensured');
}
