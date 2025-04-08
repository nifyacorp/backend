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
    // Create context with token info from request if available
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      // Extract all query parameters
      const { 
        page, 
        limit, 
        sort, 
        order, 
        type, 
        status,
        active, // Support both status and active parameters for compatibility
        search,
        frequency,
        from,
        to
      } = request.query;
      
      // Build filter options
      const filterOptions = {
        page, 
        limit, 
        sort, 
        order, 
        type
      };
      
      // Add status filter if specified
      if (status && status !== 'all') {
        filterOptions.active = status === 'active';
        filterOptions.status = status; // Add status parameter as well
        console.log('Controller: Setting active filter from status:', { 
          status, 
          active: filterOptions.active 
        });
      }
      
      // Support direct active parameter (true/false) for compatibility
      if (active !== undefined && active !== null) {
        // Properly handle various formats of the active parameter
        const isActive = active === 'true' || active === true || active === 1 || active === '1';
        filterOptions.active = isActive;
        filterOptions.status = isActive ? 'active' : 'inactive';
        console.log('Controller: Setting active filter from active parameter:', { 
          rawActive: active, 
          parsedActive: isActive,
          status: filterOptions.status
        });
      }
      
      // Ensure we're logging the final filter state
      console.log('Controller: Final filter state:', { 
        hasActiveFilter: 'active' in filterOptions,
        activeValue: filterOptions.active,
        status: filterOptions.status
      });
      
      // Add frequency filter if specified
      if (frequency && frequency !== 'all') {
        filterOptions.frequency = frequency;
      }
      
      // Add search filter if specified
      if (search) {
        filterOptions.search = search;
      }
      
      // Add date range filters if specified
      if (from) {
        filterOptions.from = new Date(from);
      }
      
      if (to) {
        filterOptions.to = new Date(to);
      }
      
      logRequest(context, 'Fetching user subscriptions with filters', { 
        userId: request.user.id,
        filterOptions
      });
      
      console.log('Route: getUserSubscriptions called with:', {
        userId: request.user.id,
        query: request.query,
        filterOptions,
        requestId: request.id
      });
      
      const result = await subscriptionService.getUserSubscriptions(
        request.user.id, 
        context,
        filterOptions
      );
      
      // Check if we received an error indicator from the service
      if (result.error) {
        console.log('Route: Service reported error:', result.error);
        // Still return a 200 with empty data
      }
      
      // Prepare filter information for response
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
      
      return {
        status: 'success',
        data: {
          subscriptions: result.subscriptions || [],
          pagination: result.pagination || {
            total: 0,
            page: parseInt(page || 1),
            limit: parseInt(limit || 20),
            totalPages: 0
          },
          filters: appliedFilters
        }
      };
    } catch (error) {
      logError(context, error);
      console.error('Route: Error in GET /subscriptions:', error);
      
      if (error instanceof AppError) {
        return reply.code(error.status).send({
          status: 'error',
          code: error.code,
          message: error.message
        });
      }
      
      // Provide more useful error response with a fallback to empty data
      return reply.code(500).send({
        status: 'error',
        code: 'SUBSCRIPTION_FETCH_ERROR',
        message: 'Failed to fetch subscription',
        data: {
          subscriptions: [],
          pagination: {
            total: 0,
            page: parseInt(request.query?.page || 1),
            limit: parseInt(request.query?.limit || 20),
            totalPages: 0
          }
        }
      });
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
    // Create context with token info from request if available
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      // More defensive handling of request.body
      if (!request.body) {
        console.error('Request body is missing or null');
        throw new AppError('VALIDATION_ERROR', 'Request body is missing', 400);
      }
      
      console.log('Request body type:', typeof request.body);
      
      // Safe extraction of body properties with defaults
      const name = request.body.name || '';
      const type = request.body.type || '';
      const typeId = request.body.typeId;
      const description = request.body.description || '';
      
      // Enhanced prompts handling to support multiple formats
      let prompts = [];
      if (request.body.prompts) {
        if (Array.isArray(request.body.prompts)) {
          prompts = request.body.prompts;
        } else if (typeof request.body.prompts === 'string') {
          prompts = [request.body.prompts];
        } else {
          // Try to parse if it's a JSON string
          try {
            const parsedPrompts = JSON.parse(request.body.prompts);
            prompts = Array.isArray(parsedPrompts) ? parsedPrompts : [String(request.body.prompts)];
          } catch (e) {
            // If parsing fails, use as a single string
            prompts = [String(request.body.prompts)];
          }
        }
      }
      
      // Log the processed prompts for debugging
      console.log('Processed prompts:', {
        original: request.body.prompts,
        processed: prompts,
        type: typeof request.body.prompts,
        isArray: Array.isArray(request.body.prompts)
      });
      
      const frequency = request.body.frequency || 'daily';
      const logo = request.body.logo;
      const metadata = request.body.metadata;
      
      // Log the full request body for debugging
      logRequest(context, 'Creating subscription - Raw request data', {
        body: JSON.stringify(request.body)
      });
      
      logRequest(context, 'Creating subscription - Parsed data', { 
        userId: request.user.id,
        subscriptionName: name,
        subscriptionType: type,
        typeId,
        prompts,
        frequency
      });
      
      const result = await subscriptionService.createSubscription({
        userId: request.user.id,
        name,
        type,
        typeId,
        description,
        prompts,
        frequency,
        logo,
        metadata
      }, context);
      
      // Extract the subscription from the result object
      // The service returns a database result with rows property
      const subscription = result?.rows?.[0] || {};
      
      // Create a properly formatted subscription object from the database result
      const validSubscription = {
        id: subscription.id || `temp-${Date.now()}`,
        name: subscription.name || name,
        description: subscription.description || description || '',
        type: subscription.type || type || 'boe',
        typeName: subscription.type_name || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'BOE'),
        typeId: subscription.type_id,
        prompts: Array.isArray(subscription.prompts) ? subscription.prompts : 
                (Array.isArray(prompts) ? prompts : []),
        frequency: subscription.frequency || frequency || 'daily',
        active: subscription.active !== undefined ? subscription.active : true,
        createdAt: subscription.created_at || new Date().toISOString(),
        updatedAt: subscription.updated_at || new Date().toISOString()
      };
      
      return reply.code(201).send({
        status: 'success',
        data: {
          subscription: validSubscription
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
    // Create context with token info from request if available
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      logRequest(context, 'Get subscription by ID request', {
        subscription_id: request.params.id,
        user_id: request.user.id
      });
      
      const subscriptionId = request.params.id;
      
      logRequest(context, 'Fetching subscription details', {
        userId: request.user.id,
        subscriptionId
      });
      
      const subscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      return {
        status: 'success',
        data: {
          subscription
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
    // Create context with token info from request if available
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      const subscriptionId = request.params.id;
      const updateData = request.body;
      
      // Verify that the subscription exists and belongs to the user
      const existingSubscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!existingSubscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      logRequest(context, 'Updating subscription', {
        userId: request.user.id,
        subscriptionId,
        updateFields: Object.keys(updateData)
      });
      
      const updatedSubscription = await subscriptionService.updateSubscription(
        request.user.id,
        subscriptionId,
        updateData,
        context
      );
      
      return {
        status: 'success',
        data: {
          subscription: updatedSubscription
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

  // DELETE /:id endpoint is now implemented in crud-delete.js with improved error handling
  // This commented section is kept for reference purposes
  /*
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
    // Implementation moved to crud-delete.js
  });
  */

  // PUT /:id - Update subscription (alias for PATCH for frontend compatibility)
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
    }
  }, async (request, reply) => {
    // Log the redirection for monitoring
    console.log('PUT endpoint redirecting to PATCH:', { 
      subscriptionId: request.params.id,
      body: request.body
    });
    
    // Redirect to PATCH endpoint with 308 status code
    // 308 Permanent Redirect preserves the request method and body
    return reply.redirect(308, `/api/v1/subscriptions/${request.params.id}`);
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
    // Create context with token info from request if available
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.userContext?.token || request.user?.token || {
        sub: request.user?.id,
        email: request.user?.email,
        name: request.user?.name
      }
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      const subscriptionId = request.params.id;
      
      // Verify that the subscription exists and belongs to the user
      const existingSubscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!existingSubscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      logRequest(context, 'Toggling subscription active status', {
        userId: request.user.id,
        subscriptionId,
        currentStatus: existingSubscription.active
      });
      
      // Use the validated active status from the request body
      const { active } = request.body;
      
      const updatedSubscription = await subscriptionService.updateSubscription(
        request.user.id,
        subscriptionId,
        { active },
        context
      );
      
      return {
        status: 'success',
        data: {
          subscription: updatedSubscription
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
} 