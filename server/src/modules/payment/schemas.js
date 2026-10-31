import { z } from 'zod';

export const recordPaymentSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'CHEQUE']),
  amount: z.number().int().positive(),
  paidOn: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).optional(),
});
