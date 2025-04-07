/**
 * Subscription CRUD Routes
 * Handles all basic CRUD operations for subscriptions
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import { validateZod } from '../../../../shared/utils/validation.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  toggleSubscriptionSchema,
  idParamSchema,
  subscriptionQuerySchema
} from '../../../../core/subscription/schemas.js';
import { apiDocumenter } from '../../../../shared/utils/api-documenter.js';

// Schema definitions
const subscriptionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
    description: { type: 'string' },
    logo: { type: 'string', format: 'uri', nullable: true },
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    frequency: { type: 'string', enum: ['immediate', 'daily'] },
    active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
};

/**
 * Register subscription CRUD routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function registerCrudRoutes(fastify, options) {
  // GET / - List user subscriptions
  fastify.get('/', {
    schema: {
      description: 'Subscription API',
      tags: ['subscriptions'],
      summary: 'List subscriptions for the authenticated user',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sort: { type: 'string', enum: ['created_at', 'updated_at', 'name', 'frequency', 'active'], default: 'created_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          type: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'all' },
          search: { type: 'string' },
          frequency: { type: 'string', enum: ['immediate', 'daily', 'all'], default: 'all' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                subscriptions: {
                  type: 'array',
                  items: subscriptionSchema
                },
                pagination: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    totalPages: { type: 'integer' }
                  }
                },
                filters: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', nullable: true },
                    status: { type: 'string', nullable: true },
                    search: { type: 'string', nullable: true },
                    frequency: { type: 'string', nullable: true },
                    dateRange: {
                      type: 'object',
                      properties: {
                        from: { type: 'string', format: 'date-time', nullable: true },
                        to: { type: 'string', format: 'date-time', nullable: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;

    logRequest(context, 'Fastify Route: GET /subscriptions called', { userId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    
    try {
      const { 
        page = 1, limit = 20, sort = 'created_at', order = 'desc', type, status, active, search, frequency, from, to 
      } = request.query;
      
      // Build filter options (similar logic as before, slightly simplified)
      const filterOptions = { page, limit, sort, order, type };
      if (status && status !== 'all') filterOptions.active = (status === 'active');
      if (active !== undefined) filterOptions.active = (String(active) === 'true');
      if (frequency && frequency !== 'all') filterOptions.frequency = frequency;
      if (search) filterOptions.search = search;
      if (from) filterOptions.from = new Date(from);
      if (to) filterOptions.to = new Date(to);

      logRequest(context, 'Fetching user subscriptions with filters', { userId, filterOptions });

      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const result = await subscriptionService.getUserSubscriptions(userId, context, filterOptions);

      // Prepare filter info for response (as before)
      const appliedFilters = {
        type: type || null,
        status: status || 'all',
        search: search || null,
        frequency: frequency || 'all',
        dateRange: {
          from: from || null,
          to: to || null
        }
      };
      
      return reply.code(200).send({
        status: 'success',
        data: {
          subscriptions: result.subscriptions || [],
          pagination: result.pagination || { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 },
          filters: appliedFilters
        }
      });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in GET /subscriptions', { userId });
      if (error instanceof AppError) {
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_FETCH_ERROR', message: 'Failed to fetch subscriptions' });
    }
  });

  // POST / - Create a new subscription
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'prompts'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string' }, // Accept any type string, will be normalized in service
          typeId: { type: 'string' }, // Template ID from frontend
          description: { type: 'string', maxLength: 500 },
          prompts: { 
            oneOf: [
              {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 3
              },
              { type: 'string' },
              { type: 'null' },
              { type: 'object' } // Allow object format for flexibility
            ]
          },
          frequency: { type: 'string' }, // Accept any frequency, will be normalized in service
          logo: { type: 'string' },
          metadata: { type: 'object' }
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
                subscription: subscriptionSchema
              }
            }
          }
        }
      }
    },
    preValidation: (request, reply, done) => {
      // Log the raw request before any validation or parsing
      console.log('Subscription creation - Raw request:', {
        method: request.method,
        url: request.url,
        headers: {
          contentType: request.headers['content-type'],
          contentLength: request.headers['content-length'],
          authorization: request.headers.authorization ? 
            `${request.headers.authorization.substring(0, 10)}...` : 'missing'
        },
        bodyKeys: Object.keys(request.body || {}),
        bodyPreview: JSON.stringify(request.body).substring(0, 200)
      });
      done();
    },
    preHandler: [
      (request, reply, done) => {
        // Log request body after parsing but before validation
        console.log('Subscription creation - After parsing:', {
          bodyIsObject: typeof request.body === 'object',
          bodyIsNull: request.body === null,
          bodyHasName: request.body && 'name' in request.body,
          bodyKeys: request.body ? Object.keys(request.body) : [],
          bodyString: JSON.stringify(request.body)
        });
        done();
      },
      validateZod(createSubscriptionSchema)
    ]
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;

    logRequest(context, 'Fastify Route: POST /subscriptions called', { userId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!request.body) {
      return reply.code(400).send({ error: 'Request body is missing' });
    }

    try {
      const { name, type, typeId, description, prompts, frequency, logo, metadata } = request.body;

      logRequest(context, 'Creating subscription - Parsed data', { userId, name, type, typeId, prompts, frequency });

      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const dbResult = await subscriptionService.createSubscription({ userId, name, type, typeId, description, prompts, frequency, logo, metadata }, context);
      
      const createdSubscription = dbResult?.rows?.[0] || {}; // Extract from DB result
      // Format response (as before)
      const responseSubscription = {
        id: createdSubscription.id || `temp-${Date.now()}`,
        name: createdSubscription.name || name,
        description: createdSubscription.description || description || '',
        type: createdSubscription.type || type || 'boe',
        typeName: createdSubscription.type_name || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'BOE'),
        typeId: createdSubscription.type_id,
        prompts: Array.isArray(createdSubscription.prompts) ? createdSubscription.prompts : 
                (Array.isArray(prompts) ? prompts : []),
        frequency: createdSubscription.frequency || frequency || 'daily',
        active: createdSubscription.active !== undefined ? createdSubscription.active : true,
        createdAt: createdSubscription.created_at || new Date().toISOString(),
        updatedAt: createdSubscription.updated_at || new Date().toISOString()
      };

      return reply.code(201).send({
        status: 'success',
        data: { subscription: responseSubscription }
      });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in POST /subscriptions', { userId });
      if (error instanceof AppError) {
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_CREATE_ERROR', message: 'Failed to create subscription' });
    }
  });

  // GET /:id - Get subscription details
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' } // Allow any string format to support both UUIDs and numeric IDs
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                subscription: subscriptionSchema
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;
    const subscriptionId = request.params.id;

    logRequest(context, 'Fastify Route: GET /subscriptions/:id called', { userId, subscriptionId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!subscriptionId) {
      return reply.code(400).send({ error: 'Subscription ID parameter is required' });
    }

    try {
      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const subscription = await subscriptionService.getSubscriptionById(userId, subscriptionId, context);
      
      // Service throws AppError if not found, so no need to check for null here
      return reply.code(200).send({
        status: 'success',
        data: { subscription }
      });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in GET /subscriptions/:id', { userId, subscriptionId });
      if (error instanceof AppError) {
        // Specifically handle NOT_FOUND from the service
        if (error.code === 'NOT_FOUND') {
           return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_FETCH_ERROR', message: 'Failed to fetch subscription details' });
    }
  });

  // PATCH /:id - Update subscription
  fastify.patch('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          prompts: { 
            anyOf: [
              {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: 3
              },
              {
                type: 'object',
                properties: {
                  value: { type: 'string', minLength: 1 }
                },
                required: ['value']
              },
              {
                type: 'string',
                minLength: 1
              }
            ]
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] },
          active: { type: 'boolean' },
          metadata: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                subscription: subscriptionSchema
              }
            }
          }
        }
      }
    },
    preHandler: [
      validateZod(idParamSchema, 'params'),
      validateZod(updateSubscriptionSchema)
    ]
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;
    const subscriptionId = request.params.id;
    const updateData = request.body;

    logRequest(context, 'Fastify Route: PATCH /subscriptions/:id called', { userId, subscriptionId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!subscriptionId || !updateData || Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Subscription ID and update data are required' });
    }

    try {
      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const updatedSubscription = await subscriptionService.updateSubscription(userId, subscriptionId, updateData, context);
      
      // Service throws if not found/unauthorized
      return reply.code(200).send({
        status: 'success',
        data: { subscription: updatedSubscription }
      });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in PATCH /subscriptions/:id', { userId, subscriptionId });
      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
           return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_UPDATE_ERROR', message: 'Failed to update subscription' });
    }
  });

  // PUT /:id - Update subscription (Alias for PATCH)
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          prompts: { 
            anyOf: [
              {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: 3
              },
              {
                type: 'object',
                properties: {
                  value: { type: 'string', minLength: 1 }
                },
                required: ['value']
              },
              {
                type: 'string',
                minLength: 1
              }
            ]
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] },
          active: { type: 'boolean' },
          metadata: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                subscription: subscriptionSchema
              }
            }
          }
        }
      }
    },
    preHandler: [
      validateZod(idParamSchema, 'params'),
      validateZod(updateSubscriptionSchema)
    ]
  }, async (request, reply) => {
    // Same handler logic as PATCH, just log the method difference
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;
    const subscriptionId = request.params.id;
    const updateData = request.body;

    logRequest(context, 'Fastify Route: PUT /subscriptions/:id called (Alias for PATCH)', { userId, subscriptionId });
    
    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!subscriptionId || !updateData || Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Subscription ID and update data are required' });
    }
    try {
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const updatedSubscription = await subscriptionService.updateSubscription(userId, subscriptionId, updateData, context);
      return reply.code(200).send({ status: 'success', data: { subscription: updatedSubscription } });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in PUT /subscriptions/:id', { userId, subscriptionId });
      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
           return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_UPDATE_ERROR', message: 'Failed to update subscription' });
    }
  });

  // PATCH /:id/toggle - Toggle subscription active status
  fastify.patch('/:id/toggle', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['active'],
        properties: {
          active: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                subscription: subscriptionSchema
              }
            }
          }
        }
      }
    },
    preHandler: [
      validateZod(idParamSchema, 'params'),
      validateZod(toggleSubscriptionSchema)
    ]
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;
    const subscriptionId = request.params.id;
    const { active } = request.body; // Validated by Zod

    logRequest(context, 'Fastify Route: PATCH /subscriptions/:id/toggle called', { userId, subscriptionId, active });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!subscriptionId || active === undefined) {
      return reply.code(400).send({ error: 'Subscription ID and active status are required' });
    }

    try {
      // Call update service method with only the 'active' field
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const updatedSubscription = await subscriptionService.updateSubscription(userId, subscriptionId, { active }, context);

      return reply.code(200).send({
        status: 'success',
        data: { subscription: updatedSubscription }
      });
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in PATCH /subscriptions/:id/toggle', { userId, subscriptionId });
      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
           return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_TOGGLE_ERROR', message: 'Failed to toggle subscription status' });
    }
  });

  // DELETE /:id - Delete a specific subscription
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' } // Allow any string format to support both UUIDs and numeric IDs
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
    const userId = request.user?.id;
    const subscriptionId = request.params.id;

    logRequest(context, 'Fastify Route: DELETE /subscriptions/:id called', { userId, subscriptionId });

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (!subscriptionId) {
      return reply.code(400).send({ error: 'Subscription ID parameter is required' });
    }

    try {
      // Call service directly
      const subscriptionService = fastify.services?.subscriptionService;
      if (!subscriptionService) throw new Error('Subscription service not available');
      const result = await subscriptionService.deleteSubscription(userId, subscriptionId, context);

      // Service handles not found/permission errors by throwing AppError
      // Check result for indication if it was already removed (optional)
      const message = result?.alreadyRemoved ? 'Subscription already removed or not found.' : 'Subscription deleted successfully.';
      return reply.code(200).send({ status: 'success', message });
      
    } catch (error) {
      logError(context, error, 'Fastify Route: Error in DELETE /subscriptions/:id', { userId, subscriptionId });
      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
           return reply.code(404).send({ status: 'error', code: error.code, message: error.message });
        }
         if (error.status === 403) { // Forbidden
           return reply.code(403).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
      }
      return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_DELETE_ERROR', message: 'Failed to delete subscription' });
    }
  });

  // DELETE / - Delete all subscriptions for the authenticated user
  fastify.delete(
    '/',
    apiDocumenter({ // Add API documentation
      summary: 'Delete All Subscriptions',
      description: 'Deletes all subscriptions associated with the authenticated user.',
      tags: ['Subscriptions'],
      responses: {
        200: {
          description: 'Subscriptions deleted successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  deletedCount: { type: 'integer' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        500: { description: 'Internal Server Error' },
      },
      security: [{ bearerAuth: [] }],
    }),
    async (request, reply) => {
      const context = { requestId: request.id, path: request.url, method: request.method }; // Basic context
      const userId = request.user?.id;

      logRequest(context, 'Fastify Route: DELETE /subscriptions called', { userId });

      if (!userId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      try {
        // Call service directly
        const subscriptionService = fastify.services?.subscriptionService;
        if (!subscriptionService) throw new Error('Subscription service not available');
        const result = await subscriptionService.deleteAllSubscriptions(userId, context);

        return reply.code(200).send({
          status: 'success',
          message: 'All subscriptions deleted successfully.',
          deletedCount: result.deletedCount
        });
      } catch (error) {
        logError(context, error, 'Fastify Route: Error in DELETE /subscriptions', { userId });
        if (error instanceof AppError) {
          return reply.code(error.status || 500).send({ status: 'error', code: error.code, message: error.message });
        }
        return reply.code(500).send({ status: 'error', code: 'SUBSCRIPTION_DELETE_ALL_ERROR', message: 'Failed to delete all subscriptions' });
      }
    }
  );
}

export default registerCrudRoutes; 