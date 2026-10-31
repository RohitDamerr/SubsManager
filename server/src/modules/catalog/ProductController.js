// ProductController — HTTP layer for products.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { encodeCursor } from '../../core/Pagination.js';
import { NotFoundError } from '../../core/AppError.js';

export class ProductController extends BaseController {
  constructor({ productService }) {
    super();
    this.productService = productService;
  }

  list = asyncHandler(async (req, res) => {
    const { limit, cursor, q, isActive } = req.query;
    const { data, hasMore } = await this.productService.list({
      limit: Number(limit) || 20,
      cursor,
      q,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
    const nextCursor = hasMore && data.length
      ? encodeCursor(data[data.length - 1], 'name')
      : null;
    return this.paginated(res, data, nextCursor);
  });

  getById = asyncHandler(async (req, res) => {
    const product = await this.productService.getById(req.params.id);
    return this.ok(res, product);
  });

  create = asyncHandler(async (req, res) => {
    const product = await this.productService.create(req.body);
    return this.created(res, product);
  });

  update = asyncHandler(async (req, res) => {
    const product = await this.productService.update(req.params.id, req.body);
    return this.ok(res, product);
  });

  addVariant = asyncHandler(async (req, res) => {
    const product = await this.productService.addVariant(req.params.id, req.body);
    return this.ok(res, product);
  });
}
