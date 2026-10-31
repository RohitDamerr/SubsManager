// DiscountService — CRUD for discount rules.  The engine does the evaluation.
import { NotFoundError, translateMongoError } from '../../core/AppError.js';

export class DiscountService {
  constructor({ discountRepo, txManager }) {
    this.discountRepo = discountRepo;
    this.txManager = txManager;
  }

  async list(query) {
    return this.discountRepo.list(query);
  }

  async getById(id) {
    const discount = await this.discountRepo.findById(id);
    if (!discount) throw new NotFoundError('Discount');
    return discount;
  }

  async create(payload) {
    return this.discountRepo.create(payload);
  }

  async update(id, update) {
    const discount = await this.discountRepo.findById(id);
    if (!discount) throw new NotFoundError('Discount');
    await this.discountRepo.update(id, update);
    return this.discountRepo.findById(id);
  }

  async setActive(id, isActive) {
    const discount = await this.discountRepo.findById(id);
    if (!discount) throw new NotFoundError('Discount');
    await this.discountRepo.update(id, { isActive });
    return this.discountRepo.findById(id);
  }
}
