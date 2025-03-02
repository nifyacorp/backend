/**
 * Subscription Processing Routes
 * Handles all routes related to subscription processing
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import axios from 'axios';

/**
 * Register subscription processing routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerProcessRoutes(fastify, options) {
  // POST /:id/process - Process a subscription immediately
  fastify.post('/:id/process', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        202: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            subscription_id: { type: 'string', format: 'uuid' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const requestContext = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }

      const subscriptionId = request.params.id;
      
      // First verify that the subscription belongs to the user
      const subscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        requestContext
      );
      
      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      // Call the subscription-worker service to process this subscription
      const subscriptionWorkerUrl = process.env.SUBSCRIPTION_WORKER_URL || 'http://localhost:8080';
      
      // Immediately send a 202 Accepted response to the client
      const response = {
        status: 'success',
        message: 'Subscription processing request accepted',
        subscription_id: subscriptionId
      };
      
      reply.code(202).send(response);
      
      // Capture the context value for the setTimeout callback
      const requestContextCopy = { ...requestContext };
      
      // Process the subscription asynchronously after sending the response
      setTimeout(async () => {
        try {
          logRequest(requestContextCopy, 'Processing subscription asynchronously', {
            subscription_id: subscriptionId,
            user_id: request.user.id
          });
          
          const processingResponse = await axios.post(
            `${subscriptionWorkerUrl}/subscriptions/process-subscription/${subscriptionId}`,
            {
              user_id: request.user.id,
              subscription_id: subscriptionId,
              metadata: subscription.metadata,
              prompts: subscription.prompts
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          logRequest(requestContextCopy, 'Subscription processing initiated', {
            subscription_id: subscriptionId,
            status: processingResponse.status,
            data: processingResponse.data
          });
        } catch (asyncError) {
          // Log the error but don't affect the client response (already sent)
          logError(requestContextCopy, asyncError, {
            subscription_id: subscriptionId
          });
        }
      }, 10); // Small delay to ensure reply is sent first
    } catch (error) {
      logError(requestContext, error);
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
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