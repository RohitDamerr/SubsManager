import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createSubscriptionSchema, transitionSchema, subscriptionQuerySchema } from './schemas.js';

export function createSubscriptionRouter({ subscriptionController }) {
  const router = Router();

  // List: Staff, Admin (customer sees own, scoped in service).
  router.get('/', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'),
    validateQuery(subscriptionQuerySchema), subscriptionController.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), subscriptionController.getById);

  // Create: Staff, Admin.
  router.post('/', authenticate, authorize('ADMIN', 'STAFF'),
    validateBody(createSubscriptionSchema), subscriptionController.create);

  // Renew (extend the term by one more term): Staff, Admin — only if the plan allows it.
  router.post('/:id/renew', authenticate, authorize('ADMIN', 'STAFF'), subscriptionController.renew);

  // Transition: Staff, Admin, Customer (pause/close only for customer).
  router.post('/:id/transition', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'),
    validateBody(transitionSchema), subscriptionController.transition);

  return router;
}
