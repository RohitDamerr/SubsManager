// DiscountController — HTTP layer for discounts.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { NotFoundError } from '../../core/AppError.js';

export class DiscountController extends BaseController {
  constructor({ discountService }) {
    super();
    this.discountService = discountService;
  }

  list = asyncHandler(async (req, res) => {
    const discounts = await this.discountService.list(req.query);
    return this.ok(res, discounts);
  });

  getById = asyncHandler(async (req, res) => {
    const discount = await this.discountService.getById(req.params.id);
    return this.ok(res, discount);
  });

  create = asyncHandler(async (req, res) => {
    const discount = await this.discountService.create(req.body);
    return this.created(res, discount);
  });

  update = asyncHandler(async (req, res) => {
    const discount = await this.discountService.update(req.params.id, req.body);
    return this.ok(res, discount);
  });
}
