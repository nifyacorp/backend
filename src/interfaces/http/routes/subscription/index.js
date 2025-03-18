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
  // Register all route groups
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