import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/sendResponse.js';
import { statusType } from '../utils/statusType.js';

export function notFound(req, _res, next) {
  next(new ApiError(statusType.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  let apiError = error;
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'CSV files must be smaller than 20 MB.'
      : error.message;
    apiError = new ApiError(statusType.BAD_REQUEST, message);
  }

  if (!(apiError instanceof ApiError)) {
    console.error(apiError);
    apiError = new ApiError(statusType.INTERNAL_SERVER_ERROR, apiError.message || 'Something went wrong.');
  }

  return sendResponse(
    res,
    false,
    { errors: apiError.errors },
    apiError.message,
    apiError.statusCode,
  );
}
