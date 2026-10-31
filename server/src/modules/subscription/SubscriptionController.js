// SubscriptionController — HTTP layer for subscriptions.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { encodeCursor } from '../../core/Pagination.js';

export class SubscriptionController extends BaseController {
  constructor({ subscriptionService }) {
    super();
    this.subscriptionService = subscriptionService;
  }

  list = asyncHandler(async (req, res) => {
    const { data, hasMore } = await this.subscriptionService.list(req.query, req.user);
    const nextCursor = hasMore && data.length
      ? encodeCursor(data[data.length - 1], 'createdAt')
      : null;
    return this.paginated(res, data, nextCursor);
  });

  getById = asyncHandler(async (req, res) => {
    const sub = await this.subscriptionService.getById(req.params.id, req.user);
    return this.ok(res, sub);
  });

  create = asyncHandler(async (req, res) => {
    const sub = await this.subscriptionService.create(req.body, req.user);
    return this.created(res, sub);
  });

  transition = asyncHandler(async (req, res) => {
    const sub = await this.subscriptionService.transition(req.params.id, req.body.to, req.user);
    return this.ok(res, sub);
  });
}
