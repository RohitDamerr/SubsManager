// validate — run a zod schema against req.body (or req.query) and attach the result.
// Always uses .strict() so unknown keys (operator-injection attempts) are rejected.
import { z } from 'zod';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.strict().safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data; // replace with parsed + stripped values
    return next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    req.query = result.data;
    return next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(result.error);
    req.params = result.data;
    return next();
  };
}

/** Reusable pagination query schema. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});
