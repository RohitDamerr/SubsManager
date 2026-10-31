import { z } from 'zod';

// ---- Product ----
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['GOOD', 'SERVICE']).default('SERVICE'),
  salesPrice: z.number().int().min(0), // minor units
  costPrice: z.number().int().min(0).optional().default(0),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
  taxIds: z.array(z.string()).default([]),
  variants: z.array(z.object({
    attribute: z.string().min(1).max(100),
    value: z.string().min(1).max(100),
    extraPrice: z.number().int().default(0),
  })).default([]),
});

export const updateProductSchema = createProductSchema.partial();

export const addVariantSchema = z.object({
  attribute: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  extraPrice: z.number().int().default(0),
});

// ---- Plan ----
export const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().min(0),
  billingPeriod: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  minQuantity: z.number().int().min(0).default(0),
  availableFrom: z.coerce.date().optional(),
  availableTo: z.coerce.date().optional(),
  autoClose: z.boolean().default(false),
  allowEarlyClose: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenew: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();
