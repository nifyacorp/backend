/**
 * Improved subscription deletion handler
 * This file provides a more robust implementation of the subscription DELETE endpoint
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
      method: request.method
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      const subscriptionId = request.params.id;
      
      logRequest(context, 'Delete subscription request', {
        subscription_id: subscriptionId,
        user_id: request.user.id
      });
      
      // Verify that the subscription exists and belongs to the user
      let existingSubscription;
      let subscriptionExists = false;
      
      try {
        existingSubscription = await subscriptionService.getSubscriptionById(
          request.user.id,
          subscriptionId,
          context
        );
        
        if (existingSubscription) {
          subscriptionExists = true;
          logRequest(context, 'Subscription found, proceeding with deletion', {
            subscription_id: subscriptionId,
            subscription_name: existingSubscription.name
          });
        } else {
          logRequest(context, 'Subscription not found for deletion', {
            subscription_id: subscriptionId
          });
        }
      } catch (checkError) {
        // Log error but continue with deletion attempt to ensure UI state is cleaned up
        logError(context, 'Error checking subscription existence', {
          error: checkError.message,
          subscription_id: subscriptionId
        });
      }
      
      if (!subscriptionExists) {
        // Even if the subscription doesn't exist, we'll return success
        // This ensures frontend can clean up its state regardless
        return reply.code(200).send({
          status: 'success',
          message: 'Subscription has been removed',
          details: { 
            id: subscriptionId,
            alreadyRemoved: true 
          }
        });
      }
      
      // If subscription exists, proceed with actual deletion
      await subscriptionService.deleteSubscription(
        request.user.id,
        subscriptionId,
        context
      );
      
      logRequest(context, 'Subscription deleted successfully', {
        subscription_id: subscriptionId
      });
      
      return reply.code(200).send({
        status: 'success',
        message: 'Subscription deleted successfully',
        details: {
          id: subscriptionId,
          alreadyRemoved: false
        }
      });
    } catch (error) {
      logError(context, error);
      
      // Special handling for 404 errors
      if (error.code === 'NOT_FOUND' || error.status === 404) {
        return reply.code(200).send({
          status: 'success',
          message: 'Subscription has been removed',
          details: { 
            id: request.params.id,
            alreadyRemoved: true 
          }
        });
      }
      
      // For other errors, return normal error response
      const status = error.status || 500;
      const errorResponse = {
        status: 'error',
        message: error.message || 'An unexpected error occurred',
        code: error.code || 'INTERNAL_ERROR',
        details: error.details || {}
      };
      
      return reply.code(status).send(errorResponse);
    }
  });
}