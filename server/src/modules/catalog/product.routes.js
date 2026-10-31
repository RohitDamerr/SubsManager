import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody, paginationQuerySchema, validateQuery } from '../../middleware/validate.js';
import { createProductSchema, updateProductSchema, addVariantSchema } from './schemas.js';

export function createProductRouter({ productController }) {
  const router = Router();

  // Read: Admin, Staff. Write: Admin.
  router.get('/',
    authenticate, authorize('ADMIN', 'STAFF'),
    validateQuery(paginationQuerySchema),
    productController.list
  );
  router.get('/:id', authenticate, authorize('ADMIN', 'STAFF'), productController.getById);
  router.post('/',
    authenticate, authorize('ADMIN'),
    validateBody(createProductSchema),
    productController.create
  );
  router.put('/:id',
    authenticate, authorize('ADMIN'),
    validateBody(updateProductSchema),
    productController.update
  );
  router.post('/:id/variants',
    authenticate, authorize('ADMIN'),
    validateBody(addVariantSchema),
    productController.addVariant
  );

  return router;
}
