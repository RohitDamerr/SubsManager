// Domain error hierarchy.  Each subclass maps to an HTTP status via errorHandler.

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404); }
}

export class ValidationError extends AppError {
  constructor(message, details = null) { super(message, 400, details); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') { super(message, 401); }
}

export class ConflictError extends AppError {
  constructor(message, details = null) { super(message, 409, details); }
}

export class BadRequestError extends AppError {
  constructor(message, details = null) { super(message, 400, details); }
}

/**
 * Translate a MongoDB error into an AppError when applicable.
 * @param {import('mongodb').MongoServerError|Error} err
 * @param {Record<string,string>} fieldMap - optional { indexKey: 'message' } for dup-key messages
 */
export function translateMongoError(err, fieldMap = {}) {
  if (err?.code === 11000) {
    const key = Object.keys(err.keyValue || {})[0] || 'value';
    const msg = fieldMap[key] || `Duplicate ${key}`;
    return new ConflictError(msg, err.keyValue);
  }
  if (err?.name === 'AppError') return err;
  return err;
}
