import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  planId: z.string(),
  validityDays: z.number().int().min(1).default(30),
  lines: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1),
  })).min(1),
});

export const updateTemplateSchema = createTemplateSchema.partial();
