import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  customerId: z.string(),
  planId: z.string(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  templateId: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1),
  })).optional(),
}).refine(
  (d) => d.templateId || (d.lines && d.lines.length > 0),
  { message: 'Either templateId or lines must be provided', path: ['lines'] }
);

export const transitionSchema = z.object({
  to: z.enum(['QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT']),
});

export const subscriptionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.string().optional(),
  customerId: z.string().optional(),
  q: z.string().optional(),
});
