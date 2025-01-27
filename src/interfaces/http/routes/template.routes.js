import { subscriptionService } from '../../../core/subscription/subscription.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { authenticate } from '../middleware/auth.middleware.js';

const templateSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    logo: { type: 'string', format: 'uri', nullable: true },
    isBuiltIn: { type: 'boolean' },
    frequency: { type: 'string', enum: ['immediate', 'daily'] },
    createdBy: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export async function templateRoutes(fastify, options) {
  // Public endpoint - List templates
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: templateSchema
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
                totalCount: { type: 'integer' },
                hasMore: { type: 'boolean' }
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
      const page = parseInt(request.query.page || '1');
      const limit = parseInt(request.query.limit || '10');
      
      const result = await subscriptionService.getPublicTemplates(context, page, limit);
      return result;
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });

  // Public endpoint - Get template details
  fastify.get('/:id', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            template: templateSchema
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
      const template = await subscriptionService.getTemplateById(request.params.id, context);
      return { template };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });

  // Protected endpoint - requires authentication
  fastify.addHook('preHandler', authenticate);

  // Create subscription from template
  fastify.post('/:id/subscribe', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                description: { type: 'string' },
                prompts: { 
                  type: 'array',
                  items: { type: 'string' }
                },
                frequency: { type: 'string', enum: ['immediate', 'daily'] },
                active: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
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

      const subscription = await subscriptionService.createFromTemplate(
        request.user.id,
        request.params.id,
        context
      );
      return { subscription };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });
}