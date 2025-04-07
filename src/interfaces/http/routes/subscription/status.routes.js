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
      
      // Log the status request
      logRequest(requestContext, 'Getting subscription processing status', {
        subscription_id: subscriptionId,
        user_id: request.user.id
      });
      
      try {
        // Check if the subscription_processing table exists
        const tableCheck = await query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'subscription_processing'
          ) as exists`
        );
        
        if (!tableCheck.rows[0].exists) {
          // Table doesn't exist, return default response
          console.log('subscription_processing table does not exist');
          const defaultProcessing = {
            status: 'pending',
            last_run_at: null,
            next_run_at: null,
            error: null,
            processing_id: 'default-no-table',
            metadata: { note: "Processing system not available" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          return reply.code(200).send({
            status: 'success',
            processing: defaultProcessing
          });
        }
      } catch (tableCheckError) {
        console.error('Error checking for subscription_processing table:', tableCheckError);
        // Continue with the query anyway
      }
      
      // Get the processing status from the database with a more resilient query
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
           subscriptions s
         LEFT JOIN 
           subscription_processing p ON p.subscription_id = s.id
         WHERE 
           s.id = $1 
           AND s.user_id = $2
         ORDER BY 
           p.created_at DESC NULLS LAST
         LIMIT 1`,
        [subscriptionId, request.user.id]
      );
      
      // If no results or no processing record exists
      if (processingResult.rows.length === 0 || !processingResult.rows[0].processing_id) {
        // Check if the subscription exists first if we didn't get any rows
        if (processingResult.rows.length === 0) {
          const subscriptionCheck = await query(
            `SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2`,
            [subscriptionId, request.user.id]
          );
          
          if (subscriptionCheck.rows.length === 0) {
            return reply.code(404).send(errorBuilders.notFound(request, "Subscription", { id: subscriptionId }));
          }
        }
        
        // Subscription exists but no processing record - create a default one
        const defaultProcessing = {
          status: 'pending',
          last_run_at: null,
          next_run_at: null,
          error: null,
          processing_id: 'unprocessed-' + Date.now(),
          metadata: { note: "No processing history available", jobId: 'unprocessed-' + Date.now() },
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
      
      // Parse metadata if it's a JSON string
      if (processing.metadata && typeof processing.metadata === 'string') {
        try {
          processing.metadata = JSON.parse(processing.metadata);
        } catch (e) {
          // If parsing fails, keep as string
          console.error('Failed to parse metadata JSON:', e);
        }
      }
      
      // Ensure metadata is an object
      if (!processing.metadata || typeof processing.metadata !== 'object') {
        processing.metadata = { jobId: processing.processing_id || 'unknown' };
      }
      
      // Add jobId field for compatibility with frontend if not present
      if (!processing.metadata.jobId) {
        processing.metadata.jobId = processing.processing_id || 'unknown';
      }
      
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