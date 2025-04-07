/**
 * Subscription Status Routes
 * Handles routes related to checking subscription processing status
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import { buildErrorResponse, errorBuilders } from '../../../../shared/errors/ErrorResponseBuilder.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
// Note: Database query is likely handled in the service, not directly in route
// import { query } from '../../../../infrastructure/database/client.js';
// No need for Express imports
// import express from 'express';
// Middleware needs to be adapted or assumed to be handled globally/via hooks in Fastify
// import { authMiddleware } from '../middleware/auth.middleware.js';
// import { apiDocumenter } from '../middleware/apiDocumenter.middleware.js'; 
// Controller import is okay, but we'll call the service directly for simplicity
import { getSubscriptionStatusController } from '../../controllers/subscription.controller.js'; 

/**
 * Register subscription status routes
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance
 * @param {object} options - Options passed to register
 */
export async function registerStatusRoutes(fastify, options) {

  // Define the route for getting subscription status using Fastify syntax
  fastify.get(
    '/:id/status',
    {
      // Add preHandler hooks for authentication if needed (Fastify style)
      // preHandler: [fastify.authenticate], // Example: if using fastify-jwt or similar
      schema: { // API documentation via Fastify schema
        summary: 'Get Subscription Processing Status',
        description: 'Retrieves the latest processing status record for a specific subscription.',
        tags: ['Subscriptions'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'The UUID of the subscription.' }
          }
        },
        response: {
          200: {
            description: 'Subscription status retrieved successfully.',
            type: 'object',
            properties: {
              processingId: { type: 'string', format: 'uuid', nullable: true },
              status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'unknown'] },
              requestedAt: { type: 'string', format: 'date-time', nullable: true },
              startedAt: { type: 'string', format: 'date-time', nullable: true },
              completedAt: { type: 'string', format: 'date-time', nullable: true },
              error: { type: 'string', nullable: true },
              message: { type: 'string', description: 'Included if status is unknown', nullable: true }
            },
          },
          401: { description: 'Unauthorized', type: 'object', properties: { error: {type: 'string'} } },
          403: { description: 'Forbidden', type: 'object', properties: { error: {type: 'string'} } },
          404: { description: 'Not Found', type: 'object', properties: { error: {type: 'string'} } },
          500: { description: 'Internal Server Error', type: 'object', properties: { error: {type: 'string'} } }
        },
        // Assuming security is defined globally or via a hook
        // security: [{ bearerAuth: [] }], 
      },
    },
    // Handler using Fastify request/reply
    async (request, reply) => {
      const context = { requestId: request.id, path: request.url, method: request.method };
      // Assuming auth middleware/hook adds user to request
      const userId = request.user?.id; 
      const subscriptionId = request.params.id;

      logRequest(context, 'Fastify Route: GET /:id/status called', { userId, subscriptionId });

      if (!userId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      if (!subscriptionId) {
        // Fastify handles param validation based on schema, but extra check doesn't hurt
        return reply.code(400).send({ error: 'Subscription ID is required' });
      }

      try {
        // Access the service from Fastify instance (assuming it's decorated)
        const subscriptionService = fastify.services?.subscriptionService;
        if (!subscriptionService) {
            logError(context, new Error('Subscription service not available on Fastify instance'));
            return reply.code(500).send({ error: 'Internal server configuration error' });
        }

        // Call the service method directly
        const status = await subscriptionService.getSubscriptionStatus(userId, subscriptionId, context);

        // Status is either the record or { status: 'unknown', message: '...' }
        return reply.code(200).send(status);

      } catch (error) {
        logError(context, error, 'Fastify Route: Error in GET /:id/status', { userId, subscriptionId });
        if (error instanceof AppError) {
          // Use error properties for response
          return reply.code(error.status || 500).send({ 
            error: error.message, 
            code: error.code, 
            details: error.details 
          });
        }
        // Generic fallback
        return reply.code(500).send({ error: 'Failed to fetch subscription status' });
      }
    }
  );

  // Register other status-related routes here if needed
}

// Export the registration function itself
export default registerStatusRoutes;