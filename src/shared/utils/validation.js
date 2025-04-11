import { z } from 'zod';
import { errorBuilders } from '../errors/ErrorResponseBuilder.js';
import { zodToJsonSchema } from '../../schemas/index.js';

/**
 * Validate data against a Zod schema and send appropriate error response if validation fails
 * 
 * @param {z.ZodType} schema - Zod schema to validate against
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {String} source - Source of data to validate (body, params, query)
 * @returns {Boolean} true if validation passes, false otherwise
 */
export function validateRequest(schema, req, res, next, source = 'body') {
  try {
    // Get data from the appropriate source
    const data = req[source];
    
    // Validate the data
    const validatedData = schema.parse(data);
    
    // Update the request object with the validated data
    req[source] = validatedData;
    
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod error messages
      const details = {};
      
      error.errors.forEach(err => {
        const path = err.path.join('.');
        details[path] = err.message;
      });
      
      // Create a validation error response
      const validationError = errorBuilders.validationError(req, details);
      next(validationError);
    } else {
      // Handle other errors
      const serverError = errorBuilders.serverError(req, error);
      next(serverError);
    }
    
    return false;
  }
}

/**
 * Create a middleware function that validates request data against a schema
 * 
 * @param {z.ZodType} schema - Zod schema to validate against
 * @param {String} source - Source of data to validate (body, params, query)
 * @returns {Function} Express middleware function
 */
export function validateZod(schema, source = 'body') {
  return (req, res, next) => {
    const isValid = validateRequest(schema, req, res, next, source);
    if (isValid) {
      next();
    }
  };
}

/**
 * Convert a Zod schema to a Fastify schema for route validation
 * 
 * @param {z.ZodType} zodSchema - Zod schema to convert
 * @returns {Object} Fastify/JSON Schema compatible object
 */
export function zodToFastifySchema(zodSchema) {
  return zodToJsonSchema(zodSchema);
}

/**
 * Create schemas for common validation patterns
 */
export const schemas = {
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),
  
  email: z.string().email({ message: 'Invalid email address format' }),
  
  pagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10)
  }),
  
  idParam: z.object({
    id: z.string().uuid({ message: 'Invalid UUID format' })
  })
};