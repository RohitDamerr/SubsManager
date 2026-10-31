// Auth routes — mounted under /api/v1
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
  changePasswordSchema,
} from './schemas.js';

export function createAuthRouter({ authController }) {
  const router = Router();

  router.post('/auth/register', validateBody(registerSchema), authController.register);
  router.post('/auth/login', validateBody(loginSchema), authController.login);
  router.post('/auth/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
  router.post('/auth/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
  router.get('/auth/me', authenticate, authController.me);
  router.post('/auth/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword);

  // Staff creation — admin only.
  router.post('/users/staff', authenticate, authorize('ADMIN'), validateBody(createStaffSchema), authController.createStaff);

  return router;
}
