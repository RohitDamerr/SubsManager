import { z } from 'zod';

const discountBaseSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['FIXED', 'PERCENT']),
  value: z.number().int().positive(),
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
  productIds: z.array(z.string()).default([]),
  minPurchase: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  usageLimit: z.number().int().min(1).nullable().default(null),
  isActive: z.boolean().default(true),
}).strict();

// Cross-field rules. Each check only runs when the fields it needs are present,
// so the same rules work for full (create) and partial (update) payloads.
const withDiscountRules = (schema) => schema.refine(
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: 'endDate must be >= startDate', path: ['endDate'] }
).refine(
  (d) => d.scope !== 'PRODUCT' || d.productIds === undefined || d.productIds.length > 0,
  { message: 'productIds required when scope is PRODUCT', path: ['productIds'] }
).refine(
  (d) => d.type !== 'PERCENT' || d.value === undefined || (d.value > 0 && d.value <= 100),
  { message: 'PERCENT value must be between 0 and 100', path: ['value'] }
);

export const createDiscountSchema = withDiscountRules(discountBaseSchema);

export const updateDiscountSchema = withDiscountRules(discountBaseSchema.partial());

export const listDiscountQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(),
});
