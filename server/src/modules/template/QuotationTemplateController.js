// QuotationTemplateController — HTTP layer for templates.
import { BaseController, asyncHandler } from '../../core/BaseController.js';

export class QuotationTemplateController extends BaseController {
  constructor({ templateService }) {
    super();
    this.templateService = templateService;
  }

  list = asyncHandler(async (req, res) => {
    const templates = await this.templateService.list(req.query);
    return this.ok(res, templates);
  });

  getById = asyncHandler(async (req, res) => {
    const template = await this.templateService.getById(req.params.id);
    return this.ok(res, template);
  });

  create = asyncHandler(async (req, res) => {
    const template = await this.templateService.create(req.body);
    return this.created(res, template);
  });

  update = asyncHandler(async (req, res) => {
    const template = await this.templateService.update(req.params.id, req.body);
    return this.ok(res, template);
  });
}
