/**
 * Subscription Processing Alternative Routes
 * Handles legacy/alternative routes for subscription processing
 * These routes redirect to the standardized API endpoints
 */

import { logRequest } from '../../../shared/logging/logger.js';

/**
 * Register alternative subscription processing routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerSubscriptionProcessingRoutes(fastify, options) {
  // GET /:id - Get processing status (redirects to standard endpoint)
  fastify.get('/:id', async (request, reply) => {
    const subscriptionId = request.params.id;
    
    // Log the redirect
    logRequest({ 
      requestId: request.id,
      path: request.url,
      method: request.method
    }, 'Redirecting deprecated status endpoint to standard endpoint', {
      from: `/api/v1/subscription-processing/${subscriptionId}`,
      to: `/api/v1/subscriptions/${subscriptionId}/status`,
    });
    
    // Redirect to the standard endpoint
    return reply.redirect(308, `/api/v1/subscriptions/${subscriptionId}/status`);
  });
} 