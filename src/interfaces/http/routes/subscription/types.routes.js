/**
 * Subscription Types Routes
 * Handles all routes related to subscription types
 */

import { typeService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

// Schema definitions
const subscriptionTypeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    icon: { type: 'string', maxLength: 50 },
    logo: { type: 'string', format: 'uri', nullable: true },
    logo_url: { type: 'string', format: 'uri', nullable: true },
    isSystem: { type: 'boolean' },
    createdBy: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

/**
 * Register subscription type routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerTypeRoutes(fastify, options) {
  // GET /types - List subscription types
  fastify.get('/types', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                types: {
                  type: 'array',
                  items: subscriptionTypeSchema
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      const userId = request.user?.id;
      
      logRequest(context, 'Fetching subscription types', { userId });
      
      const types = await typeService.getTypes(userId, context);
      
      return {
        status: 'success',
        data: {
          types
        }
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send({
          status: 'error',
          code: error.code,
          message: error.message
        });
      }
      
      return reply.code(500).send({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  });

  // POST /types - Create subscription type
  fastify.post('/types', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          description: { type: 'string' },
          icon: { type: 'string', maxLength: 50 },
          logo: { type: 'string', format: 'uri' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                type: subscriptionTypeSchema
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      const { name, description, icon, logo } = request.body;
      
      logRequest(context, 'Creating subscription type', { 
        userId: request.user.id,
        typeName: name
      });
      
      const type = await typeService.createType({
        name,
        description,
        icon,
        logo,
        createdBy: request.user.id
      }, context);
      
      return reply.code(201).send({
        status: 'success',
        data: {
          type
        }
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send({
          status: 'error',
          code: error.code,
          message: error.message
        });
      }
      
      return reply.code(500).send({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  });
} 