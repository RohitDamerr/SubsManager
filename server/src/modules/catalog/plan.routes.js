import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { createPlanSchema, updatePlanSchema } from './schemas.js';

export function createPlanRouter({ planController }) {
  const router = Router();

  // Read: all roles (customer can see plans). Write: Admin.
  router.get('/', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), planController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), planController.getById);
  router.post('/', authenticate, authorize('ADMIN'), validateBody(createPlanSchema), planController.create);
  router.put('/:id', authenticate, authorize('ADMIN'), validateBody(updatePlanSchema), planController.update);

  return router;
}
