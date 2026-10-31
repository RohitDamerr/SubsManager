import { z } from 'zod';

export const invoiceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.string().optional(),
  customerId: z.string().optional(),
  overdue: z.enum(['true', 'false']).optional(),
  q: z.string().max(40).optional(),          // invoice number search
  from: z.coerce.date().optional(),          // issue date range
  to: z.coerce.date().optional(),
});
