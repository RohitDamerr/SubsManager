import { z } from 'zod';

export const paymentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'CHEQUE']).optional(),
  q: z.string().max(100).optional(),
});

export const recordPaymentSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'CHEQUE']),
  amount: z.number().int().positive(),
  paidOn: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).optional(),
});
