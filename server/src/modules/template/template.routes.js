import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema } from './schemas.js';

export function createTemplateRouter({ templateController }) {
  const router = Router();

  // List/create/update: Admin and Staff.
  router.get('/', authenticate, authorize('ADMIN', 'STAFF'), templateController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF'), templateController.getById);
  router.post('/', authenticate, authorize('ADMIN', 'STAFF'), validateBody(createTemplateSchema), templateController.create);
  router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), validateBody(updateTemplateSchema), templateController.update);

  return router;
}
