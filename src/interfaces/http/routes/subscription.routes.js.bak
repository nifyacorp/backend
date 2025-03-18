/**
 * Subscription Routes - Main Entry Point
 * This file now serves as a centralized import for all subscription-related routes
 * to maintain backward compatibility while leveraging the refactored modular structure.
 */

import { registerTypeRoutes } from './subscription/types.routes.js';
import { registerCrudRoutes } from './subscription/crud.routes.js';
import { registerProcessRoutes } from './subscription/process.routes.js';
import { registerSharingRoutes } from './subscription/sharing.routes.js';

/**
 * Register all subscription routes with Fastify
 * 
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Additional options
 */
export async function subscriptionRoutes(fastify, options) {
  // Register all modular route groups
  await registerTypeRoutes(fastify, options);
  await registerCrudRoutes(fastify, options);
  await registerProcessRoutes(fastify, options);
  await registerSharingRoutes(fastify, options);
  
  // Add route metadata for API Explorer
  fastify.get('/', {
    schema: {
      description: 'Subscription API',
      tags: ['subscriptions'],
      summary: 'Subscription management endpoints',
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            version: { type: 'string' },
            endpoints: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return {
      service: 'Subscription API',
      version: '1.0.0',
      endpoints: [
        '/api/v1/subscriptions',
        '/api/v1/subscriptions/{id}',
        '/api/v1/subscriptions/{id}/process',
        '/api/v1/subscriptions/{id}/toggle',
        '/api/v1/subscriptions/types',
        '/api/v1/subscriptions/shares'
      ]
    };
  });
}

export default subscriptionRoutes;