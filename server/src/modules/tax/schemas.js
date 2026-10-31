import { z } from 'zod';

export const createTaxSchema = z.object({
  name: z.string().min(1).max(100),
  ratePercent: z.number().min(0).max(100),
  isInclusive: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateTaxSchema = createTaxSchema.partial();
