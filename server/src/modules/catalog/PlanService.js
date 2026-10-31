// PlanService — business rules for plans.
import { NotFoundError, translateMongoError } from '../../core/AppError.js';

export class PlanService {
  constructor({ planRepo }) {
    this.planRepo = planRepo;
  }

  async list(query) {
    const limit = Math.min(Number(query.limit) || 50, 100); // query strings arrive as text
    const rows = await this.planRepo.list({ ...query, limit });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore };
  }

  async getById(id) {
    const plan = await this.planRepo.findById(id);
    if (!plan) throw new NotFoundError('Plan');
    return plan;
  }

  async create(payload) {
    return this.planRepo.create(payload);
  }

  async update(id, update) {
    const plan = await this.planRepo.findById(id);
    if (!plan) throw new NotFoundError('Plan');
    await this.planRepo.update(id, update);
    return this.planRepo.findById(id);
  }
}
