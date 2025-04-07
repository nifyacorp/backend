import { templateService } from '../../../core/subscription/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateZod } from '../../../shared/utils/validation.js';
import { 
  createSubscriptionSchema as zodCreateTemplateSchema,
  idParamSchema
} from '../../../core/subscription/schemas.js';

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

const subscribeFromTemplateSchema = {
  type: 'object',
  properties: {
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    frequency: { type: 'string', enum: ['immediate', 'daily'] }
  }
};

export async function templateRoutes(fastify, options) {
  // GET / - List public templates
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
    const context = { requestId: request.id, path: request.url, method: request.method };
    logRequest(context, 'Fastify Route: GET /templates called');
    
    try {
      const { page = 1, limit = 10 } = request.query;
      
      const result = await templateService.getPublicTemplates(context, parseInt(page), parseInt(limit));
      
      return reply.code(200).send(result);
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in GET /templates');
      if (error instanceof AppError) {
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'TEMPLATE_FETCH_ERROR', message: 'Failed to fetch templates' });
    }
  });

  // GET /:id - Get template details
  fastify.get('/:id', {
    preHandler: [validateZod(idParamSchema, 'params')],
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
    const context = { requestId: request.id, path: request.url, method: request.method };
    const templateId = request.params.id;
    logRequest(context, 'Fastify Route: GET /templates/:id called', { templateId });

    try {
      const template = await templateService.getTemplateById(templateId, context);
      
      return reply.code(200).send({ template });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in GET /templates/:id', { templateId });
      if (error instanceof AppError) {
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'TEMPLATE_FETCH_ERROR', message: 'Failed to fetch template details' });
    }
  });

  // POST / - Create new template
  fastify.post('/', {
    preHandler: [validateZod(zodCreateTemplateSchema)],
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
    const context = { requestId: request.id, path: request.url, method: request.method };
    const userId = request.user?.id;
    logRequest(context, 'Fastify Route: POST /templates called', { userId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!request.body) {
      return reply.code(400).send({ error: 'Request body is missing' });
    }

    try {
      const template = await templateService.createTemplate(userId, request.body, context);
      
      return reply.code(201).send({ template });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in POST /templates', { userId });
      if (error instanceof AppError) {
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'TEMPLATE_CREATE_ERROR', message: 'Failed to create template' });
    }
  });

  // POST /:id/subscribe - Create subscription from template
  fastify.post('/:id/subscribe', {
    preHandler: [
      validateZod(idParamSchema, 'params'),
      validateZod(subscribeFromTemplateSchema)
    ],
    schema: {
      body: subscribeFromTemplateSchema,
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
    const context = { requestId: request.id, path: request.url, method: request.method };
    const userId = request.user?.id;
    const templateId = request.params.id;
    const customizationOptions = request.body;

    logRequest(context, 'Fastify Route: POST /templates/:id/subscribe called', { userId, templateId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      const subscription = await templateService.createFromTemplate(userId, templateId, customizationOptions, context);
      
      return reply.code(201).send({ subscription });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in POST /templates/:id/subscribe', { userId, templateId });
      if (error instanceof AppError) {
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIBE_FROM_TEMPLATE_ERROR', message: 'Failed to create subscription from template' });
    }
  });
}

export default templateRoutes;