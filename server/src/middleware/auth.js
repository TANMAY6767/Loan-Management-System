import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { statusType } from '../utils/statusType.js';

export function authenticate(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return next(new ApiError(statusType.UNAUTHORIZED, 'Please sign in to continue.'));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'local-demo-secret-change-me');
    return next();
  } catch {
    return next(new ApiError(statusType.UNAUTHORIZED, 'Your session expired. Please sign in again.'));
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new ApiError(statusType.FORBIDDEN, 'You do not have permission to do this.'));
    }
    return next();
  };
}
