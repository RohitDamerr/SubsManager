// PaymentController — HTTP layer for payments (nested under /invoices/:id/payments).
import { BaseController, asyncHandler } from '../../core/BaseController.js';

export class PaymentController extends BaseController {
  constructor({ paymentService }) {
    super();
    this.paymentService = paymentService;
  }

  listByInvoice = asyncHandler(async (req, res) => {
    const payments = await this.paymentService.listByInvoice(req.params.id, req.user);
    return this.ok(res, payments);
  });

  record = asyncHandler(async (req, res) => {
    const invoice = await this.paymentService.record(req.params.id, req.body, req.user);
    return this.created(res, invoice);
  });
}
