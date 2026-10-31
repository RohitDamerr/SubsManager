// ReportController — HTTP layer for reports.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { z } from 'zod';

const revenueQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['month', 'day']).default('month'),
});

export class ReportController extends BaseController {
  constructor({ reportService }) {
    super();
    this.reportService = reportService;
  }

  summary = asyncHandler(async (req, res) => {
    const summary = await this.reportService.summary();
    return this.ok(res, summary);
  });

  revenue = asyncHandler(async (req, res) => {
    const result = revenueQuerySchema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ error: { message: 'Invalid query', details: result.error.errors } });
    const revenue = await this.reportService.revenue(result.data);
    return this.ok(res, revenue);
  });

  overdue = asyncHandler(async (req, res) => {
    const overdue = await this.reportService.overdue(req.query);
    return this.ok(res, overdue);
  });
}
