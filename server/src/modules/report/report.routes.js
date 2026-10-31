import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export function createReportRouter({ reportController }) {
  const router = Router();

  // Dashboard and reports: Admin, Staff (staff has limited access — no cost price/margin).
  router.get('/summary', authenticate, authorize('ADMIN', 'STAFF'), reportController.summary);
  router.get('/revenue', authenticate, authorize('ADMIN', 'STAFF'), reportController.revenue);
  router.get('/overdue', authenticate, authorize('ADMIN', 'STAFF'), reportController.overdue);

  return router;
}
