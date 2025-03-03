import { subscriptionService, typeService } from '../../../core/subscription/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError, getLogger } from '../../../shared/logging/logger.js';
import axios from 'axios';

const logger = getLogger('subscription-routes');

const subscriptionTypeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    icon: { type: 'string', maxLength: 50 },
    logo: { type: 'string', format: 'uri', nullable: true },
    isSystem: { type: 'boolean' },
    createdBy: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

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
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

const createTypeSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    icon: { type: 'string', maxLength: 50 }
  }
};

const createSubscriptionSchema = {
  type: 'object',
  required: ['typeId', 'name', 'prompts', 'frequency'],
  properties: {
    typeId: { type: 'string', format: 'uuid' },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    logo: { type: 'string', format: 'uri', nullable: true },
    prompts: { 
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    frequency: { type: 'string', enum: ['immediate', 'daily'] }
  }
};

export async function subscriptionRoutes(fastify, options) {
  // Get subscription types
  fastify.get('/types', {
    schema: {
      response: {
        200: {
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
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      const types = await subscriptionService.getSubscriptionTypes(context);
      return { types };
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

  // Create subscription type
  fastify.post('/types', {
    schema: {
      body: createTypeSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            type: subscriptionTypeSchema
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

      const type = await subscriptionService.createSubscriptionType(
        request.user.id,
        request.body,
        context
      );
      return { type };
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

  // Get user subscriptions
  fastify.get('/', {
    schema: {
      response: {
        200: {
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
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      logRequest(context, 'Processing subscription request', {
        hasUser: !!request.user,
        userId: request.user?.id,
        timestamp: new Date().toISOString()
      });

      if (!request.user?.id) {
        logError(context, new Error('No user ID in request'), {
          user: request.user,
          timestamp: new Date().toISOString()
        });
        throw new AppError(
          'UNAUTHORIZED',
          'No user ID available',
          401
        );
      }

      const subscriptions = await subscriptionService.getUserSubscriptions(
        request.user.id,
        context
      );
      
      return { subscriptions };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(error.status || 500).send(response);
      return reply;
    }
  });

  // Create subscription
  fastify.post('/', {
    schema: {
      body: createSubscriptionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: subscriptionSchema
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

      const subscription = await subscriptionService.createSubscription(
        request.user.id,
        request.body,
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

  // Get subscription by ID
  fastify.get('/:id', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: subscriptionSchema
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

      const subscription = await subscriptionService.getSubscriptionById(
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

  // Update subscription
  fastify.patch('/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 100 },
          description: { type: 'string' },
          prompts: { 
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] },
          active: { type: 'boolean' }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: subscriptionSchema
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

      const subscription = await subscriptionService.updateSubscription(
        request.user.id,
        request.params.id,
        request.body,
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

  // Process subscription manually
  fastify.post('/:id/process', {
    schema: {
      response: {
        202: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            subscription_id: { type: 'string' }
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
      
      // First verify that the subscription belongs to the user
      const subscription = await subscriptionService.getSubscriptionById(
        request.user.id,
        subscriptionId,
        context
      );
      
      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }
      
      // Call the subscription-worker service to process this subscription
      const subscriptionWorkerUrl = process.env.SUBSCRIPTION_WORKER_URL || 'http://localhost:8080';
      
      // Immediately send a 202 Accepted response to the client
      const response = {
        status: 'success',
        message: 'Subscription processing request accepted',
        subscription_id: subscriptionId
      };
      
      reply.code(202).send(response);
      
      // Capture the context value for the setTimeout callback
      const requestContext = { ...context };
      
      // Process asynchronously without waiting for the response
      setTimeout(async () => {
        try {
          logger.info(requestContext, 'Making async request to subscription worker', {
            subscription_id: subscriptionId,
            worker_url: subscriptionWorkerUrl
          });
          
          const processingResponse = await axios.post(
            `${subscriptionWorkerUrl}/process-subscription/${subscriptionId}`,
            {},
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          logger.info(requestContext, 'Subscription worker responded to async request', {
            subscription_id: subscriptionId,
            status: processingResponse.status,
            response_data: processingResponse.data
          });
        } catch (asyncError) {
          // Log the error but don't affect the client response (already sent)
          logError(requestContext, asyncError, {
            subscription_id: subscriptionId
          });
        }
      }, 10); // Small delay to ensure reply is sent first
      
      return;
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

  // Delete subscription
  fastify.delete('/:id', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
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

      const result = await subscriptionService.deleteSubscription(
        request.user.id,
        request.params.id,
        context
      );
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

  // Share subscription
  fastify.post('/:id/share', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            template: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                prompts: { 
                  type: 'array',
                  items: { type: 'string' }
                },
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

      const template = await subscriptionService.shareSubscription(
        request.user.id,
        request.params.id,
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

  // Unshare subscription
  fastify.delete('/:id/share', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
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

      const result = await subscriptionService.unshareSubscription(
        request.user.id,
        request.params.id,
        context
      );
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
}