import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateQuery } from '../../middleware/validate.js';
import { invoiceQuerySchema } from './schemas.js';

export function createInvoiceRouter({ invoiceController }) {
  const router = Router();

  // List: Staff, Admin, Customer (scoped).
  router.get('/', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'),
    validateQuery(invoiceQuerySchema), invoiceController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), invoiceController.getById);

  // Actions: Staff, Admin.
  router.post('/:id/confirm', authenticate, authorize('ADMIN', 'STAFF'), invoiceController.confirm);
  router.post('/:id/cancel', authenticate, authorize('ADMIN', 'STAFF'), invoiceController.cancel);
  router.post('/:id/send', authenticate, authorize('ADMIN', 'STAFF'), invoiceController.send);
  router.get('/:id/print', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), invoiceController.print);

  // Payments are nested under invoices for the read path.
  // POST /invoices/:id/payments is handled by the payment router (mounted in app.js under /invoices).
  return router;
}
