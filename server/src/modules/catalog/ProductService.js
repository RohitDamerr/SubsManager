// ProductService — business rules for products (mostly CRUD, validation belongs here).
import { NotFoundError, translateMongoError } from '../../core/AppError.js';

export class ProductService {
  constructor({ productRepo }) {
    this.productRepo = productRepo;
  }

  async list(query) {
    const limit = query.limit || 20;
    const rows = await this.productRepo.list(query);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore };
  }

  async getById(id) {
    const product = await this.productRepo.findById(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async create(payload) {
    try {
      return await this.productRepo.create(payload);
    } catch (err) {
      const translated = translateMongoError(err);
      if (translated.statusCode) throw translated;
      throw err;
    }
  }

  async update(id, update) {
    const product = await this.productRepo.findById(id);
    if (!product) throw new NotFoundError('Product');
    await this.productRepo.update(id, update);
    return this.productRepo.findById(id);
  }

  async addVariant(id, variant) {
    const product = await this.productRepo.findById(id);
    if (!product) throw new NotFoundError('Product');
    await this.productRepo.addVariant(id, variant);
    return this.productRepo.findById(id);
  }
}
