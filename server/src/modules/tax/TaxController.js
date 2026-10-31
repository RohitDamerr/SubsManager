// TaxController — HTTP layer for taxes.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { NotFoundError } from '../../core/AppError.js';

export class TaxController extends BaseController {
  constructor({ taxRepo }) {
    super();
    this.taxRepo = taxRepo;
  }

  list = asyncHandler(async (req, res) => {
    const taxes = await this.taxRepo.list(req.query);
    return this.ok(res, taxes);
  });

  getById = asyncHandler(async (req, res) => {
    const tax = await this.taxRepo.findById(req.params.id);
    if (!tax) throw new NotFoundError('Tax');
    return this.ok(res, tax);
  });

  create = asyncHandler(async (req, res) => {
    const tax = await this.taxRepo.create(req.body);
    return this.created(res, tax);
  });

  update = asyncHandler(async (req, res) => {
    await this.taxRepo.update(req.params.id, req.body);
    const tax = await this.taxRepo.findById(req.params.id);
    return this.ok(res, tax);
  });
}
