// BillingController — manual billing run trigger (admin only).
import { BaseController, asyncHandler } from '../../core/BaseController.js';

export class BillingController extends BaseController {
  constructor({ billingService }) {
    super();
    this.billingService = billingService;
  }

  run = asyncHandler(async (req, res) => {
    const result = await this.billingService.run();
    return this.ok(res, result);
  });
}
