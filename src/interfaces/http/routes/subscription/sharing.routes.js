/**
 * Subscription Sharing Routes
 * Handles all routes related to subscription sharing
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

/**
 * Register subscription sharing routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerSharingRoutes(fastify, options) {
  // POST /:id/share - Share a subscription with another user
  fastify.post('/:id/share', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          message: { type: 'string', maxLength: 500 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
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
      const { email, message } = request.body;
      
      // First verify that the subscription belongs to the user
      const subscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      logRequest(context, 'Sharing subscription', {
        userId: request.user.id,
        subscriptionId,
        targetEmail: email
      });
      
      await subscriptionService.shareSubscription(
        request.user.id,
        subscriptionId,
        email,
        message,
        context
      );
      
      return {
        status: 'success',
        message: `Subscription shared successfully with ${email}`
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send({
          status: 'error',
          code: error.code,
          message: error.message
        });
      }
      
      return reply.code(500).send({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  });

  // DELETE /:id/share - Remove subscription sharing
  fastify.delete('/:id/share', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
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
      const { email } = request.query;
      
      // First verify that the subscription belongs to the user
      const subscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      logRequest(context, 'Removing subscription sharing', {
        userId: request.user.id,
        subscriptionId,
        targetEmail: email
      });
      
      await subscriptionService.removeSubscriptionSharing(
        request.user.id,
        subscriptionId,
        email,
        context
      );
      
      return {
        status: 'success',
        message: `Subscription sharing with ${email} removed successfully`
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send({
          status: 'error',
          code: error.code,
          message: error.message
        });
      }
      
      return reply.code(500).send({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  });
} 