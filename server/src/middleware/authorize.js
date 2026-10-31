// authorize — role guard.  Run after authenticate so req.user is set.
// Usage: router.post('/users/staff', authenticate, authorize('ADMIN'), handler)
import { ForbiddenError } from '../core/AppError.js';

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
    }
    return next();
  };
}
