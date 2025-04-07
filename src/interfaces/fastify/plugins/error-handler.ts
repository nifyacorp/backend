import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCode } from '../../../core/shared/errors/AppError';
import { ApiResponseBuilder } from '../../api/ApiResponse';

/**
 * Global error handler for the application
 */
const errorHandler: FastifyPluginAsync = async (fastify) => {
  // Set up error handler
  fastify.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    // Default error values
    let statusCode = 500;
    let errorCode = ErrorCode.UNKNOWN_ERROR;
    let message = 'An unexpected error occurred';
    let details: unknown = undefined;
    
    // Log the error
    request.log.error({
      err: error,
      requestId: request.id,
      path: request.url,
      method: request.method
    }, 'Error occurred during request processing');
    
    // Handle AppError instances
    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = error.details;
    } 
    // Handle Fastify validation errors
    else if (error.validation) {
      statusCode = 400;
      errorCode = ErrorCode.VALIDATION_ERROR;
      message = 'Validation error';
      details = error.validation;
    } 
    // Handle other errors
    else {
      // Check for status code in error
      if (error.statusCode) {
        statusCode = error.statusCode;
      }
      
      // Use error message if available
      if (error.message) {
        message = error.message;
      }
    }
    
    // Do not expose internal error details in production
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
      message = 'Internal Server Error';
      details = undefined;
    }
    
    // Send response
    const response = ApiResponseBuilder.error(errorCode.toString(), message, details);
    return reply.status(statusCode).send(response);
  });
};

export default fp(errorHandler, {
  name: 'error-handler'
});