import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { createTaxSchema, updateTaxSchema } from './schemas.js';

export function createTaxRouter({ taxController }) {
  const router = Router();

  router.get('/', authenticate, authorize('ADMIN', 'STAFF'), taxController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF'), taxController.getById);
  router.post('/', authenticate, authorize('ADMIN'), validateBody(createTaxSchema), taxController.create);
  router.put('/:id', authenticate, authorize('ADMIN'), validateBody(updateTaxSchema), taxController.update);

  return router;
}
