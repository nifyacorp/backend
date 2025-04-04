/**
 * Subscription Routes Index
 * This file combines all subscription-related routes
 */

import { registerTypeRoutes } from './types.routes.js';
import { registerCrudRoutes } from './crud.routes.js';
import { registerDeleteEndpoint } from './crud-delete.js';
import { registerProcessRoutes } from './process.routes.js';
import { registerSharingRoutes } from './sharing.routes.js';
import { registerStatusRoutes } from './status.routes.js';
import { subscriptionService } from '../../../../core/subscription/index.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

/**
 * Register all subscription routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function subscriptionRoutes(fastify, options) {
  // Add diagnostic endpoint to debug filter parsing
  fastify.get('/debug-filter', async (request, reply) => {
    // Directly expose the query parameters for debugging purposes
    const userId = request.user?.id;
    if (!userId) {
      return reply.code(401).send({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    // Parse and log all query parameters with their types
    const queryParams = {};
    for (const [key, value] of Object.entries(request.query)) {
      queryParams[key] = {
        value,
        type: typeof value,
        asBoolean: value === 'true' || value === true || value === 1 || value === '1'
      };
    }
    
    // Return diagnostic info
    return {
      status: 'success',
      message: 'Diagnostic filter information',
      data: {
        originalQuery: request.query,
        parsedQuery: queryParams,
        headerInfo: {
          contentType: request.headers['content-type'],
          accept: request.headers.accept
        }
      }
    };
  });
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
    
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };
    
    try {
      logRequest(context, 'Fetching subscription statistics', { userId });
      
      // Get actual statistics from the service
      const stats = await subscriptionService.getSubscriptionStats(userId, context);
      
      // Rename 'pending' to 'inactive' for frontend compatibility
      const { pending, ...restStats } = stats;
      
      return {
        ...restStats,
        inactive: pending || 0
      };
    } catch (error) {
      logError(context, error);
      
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
  
  // Register the improved delete endpoint to override the default one
  registerDeleteEndpoint(fastify);
  
  await registerProcessRoutes(fastify, options);
  await registerSharingRoutes(fastify, options);
  await registerStatusRoutes(fastify, options);
  
  // API metadata is now defined in crud.routes.js to avoid conflicts
}

export default subscriptionRoutes;