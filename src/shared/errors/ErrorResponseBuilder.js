import { getEndpointMetadata, findRelatedEndpoints } from '../utils/apiMetadata.js';
import { AppError } from './AppError.js';

/**
 * Build a standardized error response that includes self-documenting information
 */
export function buildErrorResponse(req, options) {
  const {
    code = 'UNKNOWN_ERROR',
    message = 'An error occurred while processing your request.',
    status = 500,
    details = {},
    error = null
  } = options;
  
  // Basic error structure
  const errorResponse = {
    error: code,
    message,
    status,
    details,
    timestamp: new Date().toISOString(),
    request_id: req.id || 'unknown'
  };
  
  // Add the original error stack in development
  if (process.env.NODE_ENV === 'development' && error) {
    errorResponse.stack = error.stack;
  }
  
  // Add self-documenting help information
  const path = req.route ? req.route.path : req.path;
  const method = req.method;
  
  // Get endpoint metadata
  const endpointMetadata = getEndpointMetadata(path, method);
  
  if (endpointMetadata) {
    // If we have metadata for this endpoint, include it
    errorResponse.help = {
      endpoint_info: endpointMetadata,
      related_endpoints: findRelatedEndpoints(path),
      documentation_url: `https://docs.nifya.app/api/v1/${path.split('/').slice(2).join('/')}`
    };
    
    // Add example request if available
    if (endpointMetadata.example_request) {
      errorResponse.help.example_request = endpointMetadata.example_request;
    }
  } else {
    // If we don't have specific metadata, provide general API info
    errorResponse.help = {
      message: "We couldn't find specific documentation for this endpoint. Here are some available endpoints:",
      available_endpoints: findRelatedEndpoints(path).slice(0, 5),
      documentation_url: "https://docs.nifya.app"
    };
  }
  
  return errorResponse;
}

// Common error builders using the existing AppError structure
export const errorBuilders = {
  badRequest: (req, message, details = {}) => {
    const errorResponse = buildErrorResponse(req, {
      code: 'BAD_REQUEST',
      message,
      status: 400,
      details
    });
    return new AppError('BAD_REQUEST', message, 400, errorResponse);
  },
  
  notFound: (req, resource = 'Resource') => {
    const message = `${resource} not found.`;
    const errorResponse = buildErrorResponse(req, {
      code: 'NOT_FOUND',
      message,
      status: 404
    });
    return new AppError('NOT_FOUND', message, 404, errorResponse);
  },
  
  unauthorized: (req, message = 'Authentication required to access this resource.') => {
    const errorResponse = buildErrorResponse(req, {
      code: 'UNAUTHORIZED',
      message,
      status: 401
    });
    return new AppError('UNAUTHORIZED', message, 401, errorResponse);
  },
  
  forbidden: (req, message = 'You do not have permission to access this resource.') => {
    const errorResponse = buildErrorResponse(req, {
      code: 'FORBIDDEN',
      message,
      status: 403
    });
    return new AppError('FORBIDDEN', message, 403, errorResponse);
  },
  
  validationError: (req, details) => {
    const message = 'The request contains invalid parameters.';
    const errorResponse = buildErrorResponse(req, {
      code: 'VALIDATION_ERROR',
      message,
      status: 400,
      details
    });
    return new AppError('VALIDATION_ERROR', message, 400, errorResponse);
  },
  
  serverError: (req, error) => {
    const message = 'An internal server error occurred.';
    const errorResponse = buildErrorResponse(req, {
      code: 'SERVER_ERROR',
      message,
      status: 500,
      error
    });
    return new AppError('SERVER_ERROR', message, 500, errorResponse);
  }
}; 