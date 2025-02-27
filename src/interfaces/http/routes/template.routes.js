import { templateService } from '../../../core/subscription/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { authenticate } from '../middleware/auth.middleware.js';

const createTemplateSchema = {
  type: 'object',
  required: ['name', 'description', 'type', 'prompts', 'frequency'],
  properties: {
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    icon: { type: 'string' },
    logo: { type: 'string', format: 'uri', nullable: true },
    metadata: { 
      type: 'object',
      properties: {
        category: { type: 'string' },
        source: { type: 'string' }
      },
      additionalProperties: true
    },
    frequency: { type: 'string', enum: ['immediate', 'daily'] },
    isPublic: { type: 'boolean', default: false }
  }
};

const templateSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    icon: { type: 'string' },
    logo: { type: 'string', format: 'uri', nullable: true },
    metadata: { 
      type: 'object',
      properties: {
        category: { type: 'string' },
        source: { type: 'string' }
      },
      additionalProperties: true
    },
    isBuiltIn: { type: 'boolean' },
    frequency: { type: 'string', enum: ['immediate', 'daily'] },
    createdBy: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true }
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
      
      const result = await templateService.getPublicTemplates(context, page, limit);
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
      const template = await templateService.getTemplateById(request.params.id, context);
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

  // Protected endpoint - Create new template
  fastify.post('/', {
    preHandler: authenticate,
    schema: {
      body: createTemplateSchema,
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
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }

      const template = await templateService.createTemplate(
        request.user.id,
        request.body,
        context
      );
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

  // Protected endpoint - Create subscription from template
  fastify.post('/:id/subscribe', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          prompts: { 
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] }
        }
      },
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

      const subscription = await templateService.createFromTemplate(
        request.user.id,
        request.params.id,
        request.body, // Pass customization options
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