/**
 * Subscription Processing Routes
 * Handles all routes related to subscription processing
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
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