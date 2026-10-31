// QuotationTemplateService — CRUD for templates.
import { NotFoundError } from '../../core/AppError.js';

export class QuotationTemplateService {
  constructor({ templateRepo }) {
    this.templateRepo = templateRepo;
  }

  async list(query) {
    return this.templateRepo.list(query);
  }

  async getById(id) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new NotFoundError('Quotation template');
    return template;
  }

  async create(payload) {
    return this.templateRepo.create(payload);
  }

  async update(id, update) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new NotFoundError('Quotation template');
    await this.templateRepo.update(id, update);
    return this.templateRepo.findById(id);
  }
}
