// Base controller — wraps async route handlers and provides response helpers.
// Catches thrown AppErrors and forwards them to errorHandler.

/**
 * Wrap an async handler so thrown errors are passed to next().
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class BaseController {
  ok(res, data, meta = null) {
    if (meta) return res.json({ data, ...meta });
    return res.json({ data });
  }

  created(res, data) {
    return res.status(201).json({ data });
  }

  paginated(res, data, nextCursor) {
    return res.json({ data, nextCursor: nextCursor || null });
  }

  noContent(res) {
    return res.status(204).end();
  }
}
