// Zod schemas for auth requests.  .strict() is applied in the validate middleware.
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().min(1).max(120),
  companyName: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  billingAddress: z.string().max(500).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string(),
});

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().min(1).max(120),
  role: z.enum(['STAFF', 'ADMIN']),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
});
