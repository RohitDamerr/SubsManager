import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export function createBillingRouter({ billingController }) {
  const router = Router();

  // Manual billing run — admin only.
  router.post('/run', authenticate, authorize('ADMIN'), billingController.run);

  return router;
}
