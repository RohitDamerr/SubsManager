// PlanController — HTTP layer for plans.
import { BaseController, asyncHandler } from '../../core/BaseController.js';

export class PlanController extends BaseController {
  constructor({ planService }) {
    super();
    this.planService = planService;
  }

  list = asyncHandler(async (req, res) => {
    const { data, hasMore } = await this.planService.list(req.query);
    // Plans are a small set; no cursor needed in practice.
    return this.paginated(res, data, null);
  });

  getById = asyncHandler(async (req, res) => {
    const plan = await this.planService.getById(req.params.id);
    return this.ok(res, plan);
  });

  create = asyncHandler(async (req, res) => {
    const plan = await this.planService.create(req.body);
    return this.created(res, plan);
  });

  update = asyncHandler(async (req, res) => {
    const plan = await this.planService.update(req.params.id, req.body);
    return this.ok(res, plan);
  });
}
