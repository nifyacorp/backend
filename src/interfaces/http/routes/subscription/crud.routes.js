/**
 * Subscription CRUD Routes
 * Handles all basic CRUD operations for subscriptions
 */

import { subscriptionService } from '../../../../core/subscription/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

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
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
      logRequest(context, 'Fetching user subscriptions', { userId: request.user.id });
      
      const subscriptions = await subscriptionService.getUserSubscriptions(request.user.id, context);
      
      return {
        status: 'success',
        data: {
          subscriptions
        }
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
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

  // POST / - Create a new subscription
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'prompts', 'frequency'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
          description: { type: 'string', maxLength: 500 },
          prompts: { 
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 3
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] },
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
      
      const { name, type, description, prompts, frequency, metadata } = request.body;
      
      logRequest(context, 'Creating subscription', { 
        userId: request.user.id,
        subscriptionName: name,
        subscriptionType: type
      });
      
      const subscription = await subscriptionService.createSubscription({
        userId: request.user.id,
        name,
        type,
        description,
        prompts,
        frequency,
        metadata
      }, context);
      
      return reply.code(201).send({
        status: 'success',
        data: {
          subscription
        }
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
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
          id: { type: 'string', format: 'uuid' }
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
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }
      
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
        return reply.code(error.statusCode).send({
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
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 3
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
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
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
        return reply.code(error.statusCode).send({
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

  // DELETE /:id - Delete subscription
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
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
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
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
      
      logRequest(context, 'Deleting subscription', {
        userId: request.user.id,
        subscriptionId
      });
      
      await subscriptionService.deleteSubscription(
        request.user.id,
        subscriptionId,
        context
      );
      
      return {
        status: 'success',
        message: 'Subscription deleted successfully'
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
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