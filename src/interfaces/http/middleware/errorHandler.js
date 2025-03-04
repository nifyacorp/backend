import { errorBuilders } from '../../../shared/errors/ErrorResponseBuilder.js';
import { AppError } from '../../../shared/errors/AppError.js';

/**
 * Global error handling middleware that transforms errors into self-documenting responses
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  console.error({
    message: 'Request error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // If it's already an AppError, just send it
  if (err instanceof AppError) {
    return res.status(err.status).json(err.toJSON());
  }
  
  // Handle different types of errors
  if (err.name === 'ValidationError') {
    // Handle validation errors (e.g., from Joi or express-validator)
    const details = err.details || err.errors || {};
    const formattedDetails = Array.isArray(details) 
      ? details.reduce((acc, d) => {
          acc[d.path || d.param] = d.message;
          return acc;
        }, {})
      : details;
    
    const error = errorBuilders.validationError(req, formattedDetails);
    return res.status(error.status).json(error.toJSON());
  }
  
  if (err.name === 'UnauthorizedError' || err.message === 'jwt expired' || err.message === 'invalid token') {
    // Handle JWT authentication errors
    const error = errorBuilders.unauthorized(req);
    return res.status(error.status).json(error.toJSON());
  }
  
  if (err.statusCode === 404 || err.name === 'NotFoundError') {
    // Handle not found errors
    const error = errorBuilders.notFound(req, err.resource || 'Resource');
    return res.status(error.status).json(error.toJSON());
  }
  
  if (err.statusCode === 403 || err.name === 'ForbiddenError') {
    // Handle forbidden errors
    const error = errorBuilders.forbidden(req);
    return res.status(error.status).json(error.toJSON());
  }
  
  // Default to server error for unhandled errors
  const error = errorBuilders.serverError(req, err);
  return res.status(error.status).json(error.toJSON());
} 