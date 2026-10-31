// Central error handler — maps AppError subclasses and Mongo errors to HTTP status.
import { ZodError } from 'zod';
import { AppError, translateMongoError } from '../core/AppError.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let error = err;

  // Zod validation -> 400
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // MongoDB errors
  if (error?.code === 11000) {
    error = translateMongoError(error);
  }

  if (error instanceof AppError) {
    const body = { error: { message: error.message } };
    if (error.details) body.error.details = error.details;
    return res.status(error.statusCode).json(body);
  }

  // Unknown errors
  console.error('[errorHandler] unhandled:', error);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}

// 404 for unmatched routes
export function notFound(req, res) {
  res.status(404).json({ error: { message: 'Route not found' } });
}
