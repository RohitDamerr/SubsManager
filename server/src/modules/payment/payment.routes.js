// Payment routes — mounted under /api/v1/invoices so paths are /:id/payments
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { recordPaymentSchema } from './schemas.js';

export function createPaymentRouter({ paymentController }) {
  const router = Router();

  // GET /:id/payments — Staff, Admin, Customer (own only, scoped in service).
  router.get('/:id/payments', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'),
    paymentController.listByInvoice);

  // POST /:id/payments — Staff, Admin only.
  router.post('/:id/payments', authenticate, authorize('ADMIN', 'STAFF'),
    validateBody(recordPaymentSchema), paymentController.record);

  return router;
}
