import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createDiscountSchema, updateDiscountSchema, listDiscountQuerySchema } from './schemas.js';

export function createDiscountRouter({ discountController }) {
  const router = Router();

  // List: Admin, Staff. CRUD: Admin.
  router.get('/', authenticate, authorize('ADMIN', 'STAFF'), validateQuery(listDiscountQuerySchema), discountController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF'), discountController.getById);
  router.post('/', authenticate, authorize('ADMIN'), validateBody(createDiscountSchema), discountController.create);
  router.put('/:id', authenticate, authorize('ADMIN'), validateBody(updateDiscountSchema), discountController.update);

  return router;
}
