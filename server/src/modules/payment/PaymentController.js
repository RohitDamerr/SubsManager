// PaymentController — HTTP layer for payments (nested under /invoices/:id/payments).
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { encodeCursor } from '../../core/Pagination.js';

export class PaymentController extends BaseController {
  constructor({ paymentService }) {
    super();
    this.paymentService = paymentService;
  }

  list = asyncHandler(async (req, res) => {
    const { data, hasMore, summary } = await this.paymentService.list(req.query, req.user);
    const nextCursor = hasMore && data.length ? encodeCursor(data[data.length - 1], 'paidOn') : null;
    return res.json({ data, nextCursor, summary });
  });

  listByInvoice = asyncHandler(async (req, res) => {
    const payments = await this.paymentService.listByInvoice(req.params.id, req.user);
    return this.ok(res, payments);
  });

  record = asyncHandler(async (req, res) => {
    const invoice = await this.paymentService.record(req.params.id, req.body, req.user);
    return this.created(res, invoice);
  });
}
