/**
 * Subscription Processing Routes
 * Handles all routes related to subscription processing
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { buildErrorResponse, errorBuilders } from "../../../../shared/errors/ErrorResponseBuilder.js";
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import { query } from '../../../../infrastructure/database/client.js';
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
          id: { type: 'string' } // Allow any string format to support both UUIDs and numeric IDs
        }
      },
      response: {
        202: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            subscription_id: { type: 'string' }
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
        return reply.code(401).send(errorBuilders.unauthorized(request, "No user ID available"));
      }

      const subscriptionId = request.params.id;
      
      // Try to verify that the subscription belongs to the user
      let subscription;
      try {
        subscription = await subscriptionService.getSubscriptionById(
          request.user.id,
          subscriptionId,
          requestContext
        );
        
        if (!subscription) {
          logError(requestContext, 'Subscription not found for processing', {
            subscription_id: subscriptionId,
            user_id: request.user.id
          });
          return reply.code(404).send(errorBuilders.notFound(request, "Subscription", { id: subscriptionId }));
        }
      } catch (lookupError) {
        logError(requestContext, 'Error looking up subscription for processing', {
          error: lookupError.message,
          subscription_id: subscriptionId,
          user_id: request.user.id
        });
        
        // Return error response instead of using fallback
        return reply.code(500).send(errorBuilders.serverError(request, 
          new Error(`Unable to fetch subscription from database: ${lookupError.message}`)));
      }
      
      // Get subscription worker URL with fallback
      const subscriptionWorkerUrl = process.env.SUBSCRIPTION_WORKER_URL || 'http://localhost:8080';
      
      // Create a processing record in the database before sending to worker
      let processingId;
      try {
        const processingResult = await query(
          `INSERT INTO subscription_processing
           (subscription_id, status, metadata)
           VALUES ($1, 'pending', $2)
           RETURNING id`,
          [
            subscriptionId,
            JSON.stringify({
              requested_by: request.user.id,
              requested_at: new Date().toISOString(),
              request_id: requestContext.requestId,
              user_agent: request.headers['user-agent']
            })
          ]
        );
        
        processingId = processingResult.rows[0].id;
        logRequest(requestContext, 'Created processing record', {
          subscription_id: subscriptionId,
          processing_id: processingId
        });
      } catch (dbError) {
        logError(requestContext, 'Failed to create processing record', {
          error: dbError.message,
          subscription_id: subscriptionId
        });
        // Continue even if we couldn't create a processing record
      }
      
      // Enhanced logging for debugging
      logRequest(requestContext, 'Processing subscription request', {
        subscription_id: subscriptionId,
        processing_id: processingId,
        worker_url: subscriptionWorkerUrl,
        env_var_set: !!process.env.SUBSCRIPTION_WORKER_URL,
        user_id: request.user.id
      });
      
      // Immediately send a 202 Accepted response to the client
      const response = {
        status: 'success',
        message: 'Subscription processing request accepted',
        subscription_id: subscriptionId,
        processing_id: processingId
      };
      
      reply.code(202).send(response);
      
      // Capture the context value for the setTimeout callback
      const requestContextCopy = { ...requestContext };
      
      // Process the subscription asynchronously after sending the response
      setTimeout(async () => {
        try {
          logRequest(requestContextCopy, 'Processing subscription asynchronously', {
            subscription_id: subscriptionId,
            processing_id: processingId,
            user_id: request.user.id,
            worker_url: subscriptionWorkerUrl
          });
          
          // Prepare request payload with full subscription data
          const payload = {
            user_id: request.user.id,
            subscription_id: subscriptionId,
            processing_id: processingId,
            metadata: subscription.metadata || {},
            prompts: subscription.prompts || [],
            type: subscription.type || subscription.typeName
          };
          
          // Log request details before sending
          logRequest(requestContextCopy, 'Sending request to subscription worker', {
            url: `${subscriptionWorkerUrl}/process-subscription/${subscriptionId}`,
            subscription_id: subscriptionId,
            timestamp: new Date().toISOString()
          });
          
          // List of endpoints to try in order (from most specific to most general)
          const endpointsToTry = [
            `${subscriptionWorkerUrl}/process-subscription/${subscriptionId}`,
            `${subscriptionWorkerUrl}/subscriptions/process-subscription/${subscriptionId}`
          ];
          
          let lastError = null;
          let success = false;
          
          // Try each endpoint until one succeeds
          for (const endpoint of endpointsToTry) {
            if (success) break;
            
            try {
              logRequest(requestContextCopy, `Trying endpoint: ${endpoint}`, {
                subscription_id: subscriptionId,
                processing_id: processingId
              });
              
              const processingResponse = await axios.post(
                endpoint,
                payload,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestContextCopy.requestId,
                    'X-Processing-ID': processingId || 'unknown'
                  },
                  timeout: 15000 // 15 second timeout
                }
              );
              
              logRequest(requestContextCopy, 'Subscription worker response received', {
                endpoint,
                status: processingResponse.status,
                data: processingResponse.data,
                subscription_id: subscriptionId,
                processing_id: processingId
              });
              
              // If we reach here, the request was successful
              success = true;
              
              // Update processing record if we have one
              if (processingId) {
                try {
                  await query(
                    `UPDATE subscription_processing
                     SET status = 'processing', 
                         updated_at = NOW(),
                         metadata = jsonb_set(metadata, '{worker_response}', $1::jsonb)
                     WHERE id = $2`,
                    [JSON.stringify(processingResponse.data || {}), processingId]
                  );
                  
                  logRequest(requestContextCopy, 'Updated processing record', {
                    subscription_id: subscriptionId,
                    processing_id: processingId,
                    status: 'processing'
                  });
                } catch (updateError) {
                  logError(requestContextCopy, 'Failed to update processing record', {
                    error: updateError.message,
                    subscription_id: subscriptionId,
                    processing_id: processingId
                  });
                }
              }
              
              break; // Exit the loop on success
            } catch (error) {
              lastError = error;
              logError(requestContextCopy, `Endpoint ${endpoint} failed`, {
                error: error.message,
                code: error.code,
                subscription_id: subscriptionId,
                processing_id: processingId,
                response: error.response?.data
              });
              
              // Continue to next endpoint
            }
          }
          
          // If all endpoints failed
          if (!success && lastError) {
            throw lastError;
          }
          
        } catch (asyncError) {
          // Log the error but don't affect the client response (already sent)
          logError(requestContextCopy, 'Failed to process subscription asynchronously', {
            error: asyncError.message,
            stack: asyncError.stack,
            subscription_id: subscriptionId,
            processing_id: processingId
          });
          
          // Update processing record to error state if we have one
          if (processingId) {
            try {
              await query(
                `UPDATE subscription_processing
                 SET status = 'error', 
                     updated_at = NOW(),
                     error = $1
                 WHERE id = $2`,
                [asyncError.message, processingId]
              );
              
              logRequest(requestContextCopy, 'Updated processing record to error state', {
                subscription_id: subscriptionId,
                processing_id: processingId,
                error: asyncError.message
              });
            } catch (updateError) {
              logError(requestContextCopy, 'Failed to update processing record error state', {
                error: updateError.message,
                subscription_id: subscriptionId,
                processing_id: processingId
              });
            }
          }
        }
      }, 10); // Small delay to ensure reply is sent first
      
    } catch (error) {
      logError(requestContext, error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send(
          buildErrorResponse(request, {
            code: error.code,
            message: error.message,
            status: error.status,
            details: error.details || {}
          })
        );
      }
      
      return reply.code(500).send(
        errorBuilders.serverError(request, error)
      );
    }
  });
}