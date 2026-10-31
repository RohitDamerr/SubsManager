// seed.js — creates admin user, demo data, and bulk test data for load testing.
// Run with: npm --prefix server run seed
import { connect, close } from '../src/config/mongo.js';
import { ensureIndexes } from './ensureIndexes.js';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

async function main() {
  const { db } = await connect();
  await ensureIndexes();

  console.log('[seed] starting...');

  // ---- Admin user ----
  const adminHash = await bcrypt.hash('Admin@123', 12);
  let admin = await db.collection('users').findOne({ email: 'admin@brightloop.com' });
  if (!admin) {
    const result = await db.collection('users').insertOne({
      email: 'admin@brightloop.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      name: 'Brightloop Admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    admin = { _id: result.insertedId };
    console.log('[seed] created admin user: admin@brightloop.com / Admin@123');
  }

  // ---- Staff user ----
  let staff = await db.collection('users').findOne({ email: 'staff@brightloop.com' });
  if (!staff) {
    const staffHash = await bcrypt.hash('Staff@123', 12);
    const result = await db.collection('users').insertOne({
      email: 'staff@brightloop.com',
      passwordHash: staffHash,
      role: 'STAFF',
      name: 'Staff Member',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    staff = { _id: result.insertedId };
    console.log('[seed] created staff user: staff@brightloop.com / Staff@123');
  }

  // ---- Customer user + profile ----
  let customerUser = await db.collection('users').findOne({ email: 'customer@brightloop.com' });
  let customerProfile;
  if (!customerUser) {
    const custHash = await bcrypt.hash('Customer@123', 12);
    customerUser = {
      _id: new ObjectId(),
      email: 'customer@brightloop.com',
      passwordHash: custHash,
      role: 'CUSTOMER',
      name: 'Acme Corp',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('users').insertOne(customerUser);
    customerProfile = {
      _id: new ObjectId(),
      userId: customerUser._id,
      companyName: 'Acme Corporation',
      phone: '+1-555-0100',
      billingAddress: '123 Main St, Springfield',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('customers').insertOne(customerProfile);
    console.log('[seed] created customer: customer@brightloop.com / Customer@123');
  } else {
    customerProfile = await db.collection('customers').findOne({ userId: customerUser._id });
  }

  // ---- Taxes ----
  const taxData = [
    { name: 'GST 18%', ratePercent: 18, isInclusive: false, isActive: true },
    { name: 'GST 5%', ratePercent: 5, isInclusive: false, isActive: true },
  ];
  const taxIds = [];
  for (const t of taxData) {
    let tax = await db.collection('taxes').findOne({ name: t.name });
    if (!tax) {
      const result = await db.collection('taxes').insertOne({ ...t, createdAt: new Date(), updatedAt: new Date() });
      tax = { _id: result.insertedId };
    }
    taxIds.push(tax._id);
  }
  console.log('[seed] taxes ready');

  // ---- Products with variants ----
  const productData = [
    {
      name: 'Odoo Hosting — Standard',
      type: 'SERVICE',
      salesPrice: 56000,
      costPrice: 20000,
      taxIds: [taxIds[0]],
      isActive: true,
      variants: [
        { _id: new ObjectId(), attribute: 'brand', value: 'Odoo', extraPrice: 0 },
        { _id: new ObjectId(), attribute: 'brand', value: 'Odoo Enterprise', extraPrice: 14000 },
      ],
    },
    {
      name: 'Email Add-on',
      type: 'SERVICE',
      salesPrice: 10000,
      taxIds: [taxIds[0]],
      isActive: true,
      variants: [],
    },
  ];
  const productIds = [];
  for (const p of productData) {
    let product = await db.collection('products').findOne({ name: p.name });
    if (!product) {
      const result = await db.collection('products').insertOne({ ...p, createdAt: new Date(), updatedAt: new Date() });
      product = { _id: result.insertedId };
    }
    productIds.push(product._id);
  }
  console.log('[seed] products ready');

  // ---- Plans ----
  const planData = [
    {
      name: 'Monthly Standard',
      price: 56000,
      billingPeriod: 'MONTHLY',
      minQuantity: 1,
      autoClose: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenew: true,
    },
    {
      name: 'Annual Enterprise',
      price: 672000,
      billingPeriod: 'YEARLY',
      minQuantity: 5,
      autoClose: true,
      allowEarlyClose: false,
      allowPause: false,
      allowRenew: true,
    },
  ];
  const planIds = [];
  for (const p of planData) {
    let plan = await db.collection('plans').findOne({ name: p.name });
    if (!plan) {
      const result = await db.collection('plans').insertOne({ ...p, createdAt: new Date(), updatedAt: new Date() });
      plan = { _id: result.insertedId };
    }
    planIds.push(plan._id);
  }
  console.log('[seed] plans ready');

  // ---- Discounts ----
  const discountData = [
    {
      name: '10% off Odoo Hosting',
      type: 'PERCENT',
      value: 10,
      scope: 'PRODUCT',
      productIds: [productIds[0]],
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: null,
      isActive: true,
      usedCount: 0,
    },
    {
      name: '₹5000 off subscriptions over ₹50000',
      type: 'FIXED',
      value: 500000,
      scope: 'SUBSCRIPTION',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 100,
      isActive: true,
      usedCount: 0,
    },
  ];
  for (const d of discountData) {
    const existing = await db.collection('discounts').findOne({ name: d.name });
    if (!existing) {
      await db.collection('discounts').insertOne({ ...d, createdAt: new Date(), updatedAt: new Date() });
    }
  }
  console.log('[seed] discounts ready');

  // ---- Quotation template ----
  const templateData = {
    name: 'Standard Odoo Setup',
    planId: planIds[0],
    validityDays: 30,
    lines: [
      { productId: productIds[0], variantId: productData[0].variants[0]._id, quantity: 1 },
      { productId: productIds[1], quantity: 1 },
    ],
  };
  const existingTemplate = await db.collection('quotationTemplates').findOne({ name: templateData.name });
  if (!existingTemplate) {
    await db.collection('quotationTemplates').insertOne({ ...templateData, createdAt: new Date(), updatedAt: new Date() });
  }
  console.log('[seed] templates ready');

  // ---- Bulk load test: 10,000 subscriptions ----
  const bulkCount = parseInt(process.argv[2]) || 0;
  if (bulkCount > 0) {
    console.log(`[seed] generating ${bulkCount} subscriptions...`);
    const subs = [];
    const now = new Date();
    for (let i = 0; i < bulkCount; i++) {
      subs.push({
        number: `SUB-${String(100000 + i).padStart(6, '0')}`,
        customerId: customerProfile._id,
        planId: planIds[0],
        status: i % 5 === 0 ? 'ACTIVE' : 'CLOSED',
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        paymentTermsDays: 30,
        nextInvoiceDate: i % 5 === 0 ? new Date(now.getTime() + (i % 7) * 24 * 60 * 60 * 1000) : null,
        lastBilledPeriodEnd: null,
        monthlyAmount: 56000,
        lines: [
          {
            productId: productIds[0],
            variantId: productData[0].variants[0]._id,
            name: 'Odoo Hosting — Standard (brand: Odoo)',
            quantity: 1,
            unitPrice: 56000,
            taxRate: 18,
            amount: 56000,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    if (subs.length) await db.collection('subscriptions').insertMany(subs);
    console.log(`[seed] inserted ${bulkCount} subscriptions`);
  }

  console.log('[seed] done');
  await close();
}

main().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
