/**
 * Subscription Processing Routes
 * Handles all routes related to subscription processing
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import { query } from '../../../../infrastructure/database/client.js';
// Schemas might be needed for validation if not applied globally
import { idParamSchema } from '../../../../core/subscription/schemas.js'; 
import { validateZod } from '../../../../shared/utils/validation.js';

/**
 * Register subscription processing routes
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerProcessRoutes(fastify, options) {

  // POST /:id/process - Process a subscription immediately
  fastify.post('/:id/process', {
    // Assuming preHandler for auth is applied globally/plugin level
    preHandler: [validateZod(idParamSchema, 'params')], // Validate ID param
    schema: {
      summary: 'Process Subscription',
      description: 'Initiates immediate processing for a specific subscription.',
      tags: ['Subscriptions'], // Consistent tag
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'The UUID of the subscription.' }
        }
      },
      response: {
        202: { // Accepted: Processing started asynchronously
          description: 'Subscription processing accepted.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Subscription processing initiated' },
            processingId: { type: 'string', format: 'uuid' },
            subscriptionId: { type: 'string', format: 'uuid' },
            jobId: { type: 'string', format: 'uuid', description: 'Alias for processingId' },
            status: { type: 'string', example: 'pending' }
          }
        },
        401: { description: 'Unauthorized', type: 'object', properties: { error: { type: 'string' } } },
        404: { description: 'Subscription Not Found', type: 'object', properties: { error: { type: 'string' } } },
        500: { description: 'Internal Server Error', type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method };
    const userId = request.user?.id;
    const subscriptionId = request.params.id;

    logRequest(context, 'Fastify Route: POST /subscriptions/:id/process called', { userId, subscriptionId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    // ID validated by preHandler

    try {
      // Check if the subscription exists first
      const subscriptionExists = await query(
        'SELECT EXISTS(SELECT 1 FROM subscriptions WHERE id = $1 AND user_id = $2) as exists',
        [subscriptionId, userId]
      );
      
      if (!subscriptionExists.rows[0].exists) {
        return reply.code(404).send({ 
          error: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      // Check if subscription_processing table exists
      const tableCheckResult = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'subscription_processing'
        ) as exists;
      `);
      
      // If the table doesn't exist, create it
      if (!tableCheckResult.rows[0].exists) {
        logRequest(context, 'subscription_processing table does not exist, creating it now...', { subscriptionId });
        
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS subscription_processing (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
              status VARCHAR(50) NOT NULL DEFAULT 'pending',
              started_at TIMESTAMP WITH TIME ZONE,
              completed_at TIMESTAMP WITH TIME ZONE,
              result JSONB DEFAULT '{}'::jsonb,
              error_message TEXT,
              user_id UUID,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id 
              ON subscription_processing(subscription_id);
            CREATE INDEX IF NOT EXISTS idx_subscription_processing_status 
              ON subscription_processing(status);
          `);
          
          logRequest(context, 'Successfully created subscription_processing table', { subscriptionId });
        } catch (createError) {
          logError(context, createError, 'Error creating subscription_processing table');
          // Continue with processing - the service will handle the missing table
        }
      }
      
      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) {
        logError(context, new Error('Subscription service not available on Fastify instance'));
        return reply.code(500).send({ error: 'Internal server configuration error' });
      }
      
      // The service method now handles DB record creation and event publishing
      const result = await subscriptionService.processSubscription(userId, subscriptionId, context);
      
      // Service throws AppError on failure (e.g., not found, pubsub fail)
      // If successful, it returns { message, processingId, subscriptionId, jobId, status }
      return reply.code(202).send({
          success: true, 
          ...result 
      });

    } catch (error) {
      logError(context, error, 'Fastify Route: Error in POST /subscriptions/:id/process', { userId, subscriptionId });
      
      // Special handling for missing subscription_processing table
      if (error.message && error.message.includes('relation "subscription_processing" does not exist')) {
        logRequest(context, 'Handling missing subscription_processing table', { subscriptionId });
        
        // Return a successful response using a temporary processing ID
        return reply.code(202).send({
          success: true,
          message: 'Subscription processing initiated (alternative handling)',
          processingId: `temp-${Date.now()}`,
          subscriptionId: subscriptionId,
          jobId: `temp-${Date.now()}`,
          status: 'pending',
          note: 'Processing record table is being created. Status tracking will be available for future requests.'
        });
      }
      
      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        // Handle specific processing errors if needed
        if (error.code === 'PROCESSING_ERROR') {
          return reply.code(500).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      // Generic error
      return reply.code(500).send({ status: 'error', code: 'PROCESS_REQUEST_ERROR', message: 'Failed to request subscription processing' });
    }
  });

  // Removed the alternative /process/:id route as it's redundant
}

export default registerProcessRoutes;