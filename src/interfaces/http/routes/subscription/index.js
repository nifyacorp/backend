/**
 * Subscription Routes Index
 * This file combines all subscription-related routes
 */

import { registerTypeRoutes } from './types.routes.js';
import { registerCrudRoutes } from './crud.routes.js';
import { registerProcessRoutes } from './process.routes.js';
import { registerSharingRoutes } from './sharing.routes.js';

/**
 * Register all subscription routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function subscriptionRoutes(fastify, options) {
  // Add stats endpoint - must be defined before the ID routes to avoid conflict
  fastify.get('/stats', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            active: { type: 'integer' },
            inactive: { type: 'integer' },
            bySource: { 
              type: 'object',
              additionalProperties: { type: 'integer' }
            },
            byFrequency: {
              type: 'object',
              additionalProperties: { type: 'integer' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user?.id;
    
    if (!userId) {
      return reply.code(401).send({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    try {
      // Here you would normally query the database for actual stats
      // For now, return dummy data to fix the 400 error
      return {
        total: 0,
        active: 0,
        inactive: 0,
        bySource: {},
        byFrequency: {
          'daily': 0,
          'immediate': 0
        }
      };
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
      return reply.code(500).send({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch subscription statistics'
      });
    }
  });
  
  // Register all route groups after the special routes
  await registerTypeRoutes(fastify, options);
  await registerCrudRoutes(fastify, options);
  await registerProcessRoutes(fastify, options);
  await registerSharingRoutes(fastify, options);
  
  // API metadata is now defined in crud.routes.js to avoid conflicts
}

export default subscriptionRoutes;