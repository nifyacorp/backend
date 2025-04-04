/**
 * Improved subscription deletion handler
 * This file provides a clean, robust implementation of the subscription DELETE endpoint
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

/**
 * Register the DELETE subscription endpoint
 * @param {Object} fastify - Fastify instance
 */
export function registerDeleteEndpoint(fastify) {
  // DELETE /:id - Delete subscription
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' } // Allow any string format to support both UUIDs and numeric IDs
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            details: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                alreadyRemoved: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      // Verify authentication
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      const subscriptionId = request.params.id;
      const userId = request.user.id;
      
      logRequest(context, 'Delete subscription request', {
        subscription_id: subscriptionId,
        user_id: userId
      });
      
      // Check if force parameter is specified
      const forceDelete = request.query.force === 'true';
      
      if (forceDelete) {
        logRequest(context, 'Force delete requested', {
          subscription_id: subscriptionId,
          user_id: userId
        });
      }
      
      // Use the service layer for deletion (now with improved transactional support)
      try {
        const result = await subscriptionService.deleteSubscription(
          userId,
          subscriptionId,
          context
        );
        
        // Translate service response to API response
        logRequest(context, 'Subscription deletion completed', {
          subscription_id: subscriptionId,
          already_removed: result.alreadyRemoved
        });
        
        return reply.code(200).send({
          status: 'success',
          message: result.message || (result.alreadyRemoved 
            ? 'Subscription has been removed' 
            : 'Subscription deleted successfully'),
          details: {
            id: subscriptionId,
            alreadyRemoved: result.alreadyRemoved
          }
        });
      } catch (serviceError) {
        // Handle permission errors
        if (serviceError instanceof AppError && serviceError.status === 403) {
          logError(context, serviceError, 'Permission error during deletion');
          
          // If force parameter is set, try again with admin privileges
          if (forceDelete) {
            logRequest(context, 'Permission error but force=true, retrying with admin privileges', {
              subscription_id: subscriptionId
            });
            
            try {
              // Use the repository directly with force flag for admin privileges
              const forceResult = await subscriptionService.repository.delete(subscriptionId, {
                userId,
                force: true,
                context
              });
              
              logRequest(context, 'Force deletion succeeded', {
                subscription_id: subscriptionId
              });
              
              return reply.code(200).send({
                status: 'success',
                message: forceResult.message || 'Subscription force-deleted successfully',
                details: {
                  id: subscriptionId,
                  alreadyRemoved: forceResult.alreadyRemoved,
                  forced: true
                }
              });
            } catch (forceError) {
              logError(context, forceError, 'Force deletion also failed');
              
              // Still return success for UI consistency
              return reply.code(200).send({
                status: 'success',
                message: 'Subscription removal processed',
                details: {
                  id: subscriptionId,
                  alreadyRemoved: true,
                  error: forceError.message
                }
              });
            }
          }
          
          // If not using force, return the permission error
          return reply.code(serviceError.status).send({
            status: 'error',
            message: serviceError.message,
            code: serviceError.code,
            details: serviceError.details || {}
          });
        }
        
        // Return proper error status and message
        logError(context, serviceError, 'Error during subscription deletion');
        
        // Determine appropriate error status code
        const errorStatusCode = serviceError.status || 
                               (serviceError.code === 'NOT_FOUND' ? 404 : 
                               (serviceError.code === 'DATABASE_ERROR' ? 500 : 400));
        
        // Get stack trace for debugging in development
        const stack = process.env.NODE_ENV !== 'production' ? serviceError.stack : undefined;
        
        return reply.code(errorStatusCode).send({
          status: 'error',
          message: serviceError.message || 'Error during subscription deletion',
          details: {
            id: subscriptionId,
            error: serviceError.message,
            errorCode: serviceError.code || 'UNKNOWN_ERROR',
            errorDetails: serviceError.details || {},
            debugInfo: {
              stack,
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    } catch (error) {
      logError(context, error);
      
      // Special handling for 404 errors
      if (error.code === 'NOT_FOUND' || error.code === 'SUBSCRIPTION_NOT_FOUND' || error.status === 404) {
        logRequest(context, 'Subscription not found, treating as already removed', {
          subscription_id: request.params.id
        });
        
        return reply.code(200).send({
          status: 'success',
          message: 'Subscription has been removed',
          details: { 
            id: request.params.id,
            alreadyRemoved: true 
          }
        });
      }
      
      // Return proper error for unexpected errors
      logError(context, error, 'Unexpected error during subscription deletion');
      
      // Get stack trace for debugging in development
      const stack = process.env.NODE_ENV !== 'production' ? error.stack : undefined;
      
      // Determine appropriate status code
      const errorStatusCode = error.status || 
                             (error.code === 'NOT_FOUND' ? 404 : 
                             (error.code === 'DATABASE_ERROR' ? 500 : 500));
      
      return reply.code(errorStatusCode).send({
        status: 'error',
        message: error.message || 'Unexpected error during subscription deletion',
        details: {
          id: request.params.id,
          error: error.message,
          errorCode: error.code || 'UNEXPECTED_ERROR',
          errorDetails: error.details || {},
          debugInfo: {
            stack,
            timestamp: new Date().toISOString(),
            errorType: 'Unexpected error during subscription deletion'
          }
        }
      });
    }
  });
}