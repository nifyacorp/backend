import { getEndpointMetadata } from '../../../shared/utils/apiMetadata.js';
import { errorBuilders } from '../../../shared/errors/ErrorResponseBuilder.js';

/**
 * Middleware to validate requests against API metadata and provide self-documenting errors
 */
export function apiDocumenter(req, res, next) {
  // Get metadata for this endpoint
  const path = req.route ? req.route.path : req.path;
  const method = req.method;
  const metadata = getEndpointMetadata(path, method);
  
  // If no metadata found, continue without validation
  if (!metadata) {
    return next();
  }
  
  // Validate required path parameters
  if (metadata.path_parameters) {
    const errors = {};
    
    metadata.path_parameters.forEach(param => {
      const paramValue = req.params[param.name];
      
      if (param.required && (paramValue === undefined || paramValue === null)) {
        errors[param.name] = `Missing required path parameter: ${param.name}`;
      } else if (paramValue !== undefined && param.type === 'uuid') {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(paramValue)) {
          errors[param.name] = `Invalid UUID format for parameter: ${param.name}`;
        }
      }
    });
    
    if (Object.keys(errors).length > 0) {
      const error = errorBuilders.validationError(req, errors);
      return next(error);
    }
  }
  
  // Validate required query parameters
  if (metadata.query_parameters) {
    const requiredParams = metadata.query_parameters.filter(p => p.required);
    const errors = {};
    
    requiredParams.forEach(param => {
      if (req.query[param.name] === undefined) {
        errors[param.name] = `Missing required query parameter: ${param.name}`;
      }
    });
    
    if (Object.keys(errors).length > 0) {
      const error = errorBuilders.validationError(req, errors);
      return next(error);
    }
  }
  
  // Validate required body parameters for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(method) && metadata.body_parameters) {
    const requiredParams = metadata.body_parameters.filter(p => p.required);
    const errors = {};
    
    requiredParams.forEach(param => {
      if (req.body === undefined || req.body[param.name] === undefined) {
        errors[param.name] = `Missing required body parameter: ${param.name}`;
      }
    });
    
    if (Object.keys(errors).length > 0) {
      const error = errorBuilders.validationError(req, errors);
      return next(error);
    }
  }
  
  // If all validations pass, continue
  next();
} 