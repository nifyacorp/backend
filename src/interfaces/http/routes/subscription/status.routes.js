/**
 * Subscription Status Routes
 * Handles routes related to checking subscription processing status
 */

import { buildErrorResponse, errorBuilders } from "../../../../shared/errors/ErrorResponseBuilder.js";
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import { query } from '../../../../infrastructure/database/client.js';

/**
 * Register subscription status routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerStatusRoutes(fastify, options) {
  // GET /:id/status - Get processing status of a subscription
  fastify.get('/:id/status', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            processing: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                last_run_at: { type: 'string', nullable: true },
                next_run_at: { type: 'string', nullable: true },
                error: { type: 'string', nullable: true },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
                processing_id: { type: 'string' },
                metadata: { 
                  type: 'object',
                  additionalProperties: true,
                  nullable: true
                }
              }
            }
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
      
      // Get the processing status from the database
      const processingResult = await query(
        `SELECT 
           p.id as processing_id, 
           p.status, 
           p.last_run_at, 
           p.next_run_at, 
           p.error, 
           p.metadata, 
           p.created_at, 
           p.updated_at
         FROM 
           subscription_processing p
         JOIN 
           subscriptions s ON p.subscription_id = s.id
         WHERE 
           p.subscription_id = $1 
           AND s.user_id = $2
         ORDER BY 
           p.created_at DESC
         LIMIT 1`,
        [subscriptionId, request.user.id]
      );
      
      // If no processing record exists
      if (processingResult.rows.length === 0) {
        // Check if the subscription exists first
        const subscriptionCheck = await query(
          `SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2`,
          [subscriptionId, request.user.id]
        );
        
        if (subscriptionCheck.rows.length === 0) {
          return reply.code(404).send(errorBuilders.notFound(request, "Subscription", { id: subscriptionId }));
        }
        
        // Subscription exists but no processing record - create a default one
        const defaultProcessing = {
          status: 'pending',
          last_run_at: null,
          next_run_at: null,
          error: null,
          processing_id: 'unprocessed',
          metadata: { note: "No processing history available" },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        logRequest(requestContext, 'No processing record found, returning default status', {
          subscription_id: subscriptionId,
          user_id: request.user.id
        });
        
        return reply.code(200).send({
          status: 'success',
          processing: defaultProcessing
        });
      }
      
      // Return the processing status
      const processing = processingResult.rows[0];
      
      // Convert dates to ISO strings for consistent API response
      if (processing.last_run_at) processing.last_run_at = processing.last_run_at.toISOString();
      if (processing.next_run_at) processing.next_run_at = processing.next_run_at.toISOString();
      if (processing.created_at) processing.created_at = processing.created_at.toISOString();
      if (processing.updated_at) processing.updated_at = processing.updated_at.toISOString();
      
      // Log the status check
      logRequest(requestContext, 'Retrieved subscription processing status', {
        subscription_id: subscriptionId,
        processing_status: processing.status,
        processing_id: processing.processing_id
      });
      
      return reply.code(200).send({
        status: 'success',
        processing
      });
      
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