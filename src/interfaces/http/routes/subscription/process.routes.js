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
      
      // Enhanced logging for debugging
      logRequest(requestContext, 'Processing subscription request', {
        subscription_id: subscriptionId,
        worker_url: subscriptionWorkerUrl,
        env_var_set: !!process.env.SUBSCRIPTION_WORKER_URL
      });
      
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
            user_id: request.user.id,
            worker_url: subscriptionWorkerUrl
          });
          
          // Log request details before sending
          logRequest(requestContextCopy, 'Sending request to subscription worker', {
            url: `${subscriptionWorkerUrl}/subscriptions/process-subscription/${subscriptionId}`,
            subscription_id: subscriptionId,
            timestamp: new Date().toISOString()
          });
          
          // Try the primary endpoint path
          try {
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
                },
                timeout: 10000 // 10 second timeout
              }
            );
            
            logRequest(requestContextCopy, 'Subscription worker primary endpoint response', {
              status: processingResponse.status,
              data: processingResponse.data,
              subscription_id: subscriptionId
            });
          } catch (primaryError) {
            // Log the error from the primary endpoint
            logError(requestContextCopy, 'Primary endpoint failed', {
              error: primaryError.message,
              code: primaryError.code,
              subscription_id: subscriptionId,
              response: primaryError.response?.data
            });
            
            // Try the fallback endpoint path
            logRequest(requestContextCopy, 'Trying fallback endpoint');
            try {
              const fallbackResponse = await axios.post(
                `${subscriptionWorkerUrl}/process-subscription/${subscriptionId}`,
                {
                  user_id: request.user.id,
                  subscription_id: subscriptionId,
                  metadata: subscription.metadata,
                  prompts: subscription.prompts
                },
                {
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000 // 10 second timeout
                }
              );
              
              logRequest(requestContextCopy, 'Subscription worker fallback endpoint response', {
                status: fallbackResponse.status,
                data: fallbackResponse.data,
                subscription_id: subscriptionId
              });
            } catch (fallbackError) {
              // Log the error from the fallback endpoint
              logError(requestContextCopy, 'Fallback endpoint also failed', {
                primary_error: primaryError.message,
                fallback_error: fallbackError.message,
                subscription_id: subscriptionId,
                response: fallbackError.response?.data
              });
              
              // Throw to be caught by the outer catch
              throw new Error(`Both endpoints failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
            }
          }
        } catch (asyncError) {
          // Log the error but don't affect the client response (already sent)
          logError(requestContextCopy, 'Failed to process subscription asynchronously', {
            error: asyncError.message,
            stack: asyncError.stack,
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