// Auth routes — mounted under /api/v1
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { z } from 'zod';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
  changePasswordSchema,
} from './schemas.js';

const customerQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export function createAuthRouter({ authController }) {
  const router = Router();

  router.post('/auth/register', validateBody(registerSchema), authController.register);
  router.post('/auth/login', validateBody(loginSchema), authController.login);
  router.post('/auth/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
  router.post('/auth/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
  router.get('/auth/me', authenticate, authController.me);
  router.post('/auth/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword);

  // Staff accounts — admin only.
  router.get('/users/staff', authenticate, authorize('ADMIN'), authController.listStaff);
  router.post('/users/staff', authenticate, authorize('ADMIN'), validateBody(createStaffSchema), authController.createStaff);

  // Customer directory (for picking a customer on a subscription) — Admin, Staff.
  router.get('/customers', authenticate, authorize('ADMIN', 'STAFF'), validateQuery(customerQuerySchema), authController.listCustomers);

  return router;
}
