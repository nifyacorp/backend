import { subscriptionService, typeService } from '../../../core/subscription/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import axios from 'axios';

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

const subscriptionResponseSchema = {
  type: 'object',
  properties: {
    subscriptions: {
      type: 'array',
      items: subscriptionSchema
    },
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    totalPages: { type: 'integer' },
    hasMore: { type: 'boolean' }
  }
};

const subscriptionRequestBodySchema = {
  type: 'object',
  required: ['name', 'typeId'],
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
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'getTypes'
    };
    
    try {
      logRequest(context, 'Getting subscription types', { userId });
      
      const types = await typeService.getSubscriptionTypes(userId, context);
      
      return reply.send({
        types
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve subscription types'
      });
    }
  });

  /**
   * Get subscription statistics
   */
  fastify.get('/stats', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            active: { type: 'integer' },
            pending: { type: 'integer' },
            bySource: { type: 'object', additionalProperties: { type: 'integer' } },
            byFrequency: { type: 'object', additionalProperties: { type: 'integer' } }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'getSubscriptionStats'
    };
    
    try {
      logRequest(context, 'Getting subscription statistics', { userId });
      
      const stats = await subscriptionService.getSubscriptionStats(userId, context);
      
      return reply.send(stats);
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve subscription statistics'
      });
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
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'getUserSubscriptions'
    };
    
    try {
      logRequest(context, 'Getting user subscriptions', { userId });
      
      const subscriptions = await subscriptionService.getUserSubscriptions(userId, context);
      
      return reply.send({
        subscriptions
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve subscriptions'
      });
    }
  });
  
  // Get a single subscription
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
        200: subscriptionSchema
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'getSubscriptionById'
    };
    
    try {
      logRequest(context, 'Getting subscription by ID', { 
        userId, 
        subscriptionId: id 
      });
      
      const subscription = await subscriptionService.getSubscriptionById(userId, id, context);
      
      return reply.send(subscription);
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve subscription'
      });
    }
  });
  
  // Create a new subscription
  fastify.post('/', {
    schema: {
      body: subscriptionRequestBodySchema,
      response: {
        201: {
          type: 'object',
          properties: {
            subscription: subscriptionSchema,
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const subscriptionData = request.body;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'createSubscription'
    };
    
    try {
      logRequest(context, 'Creating new subscription', { 
        userId,
        subscriptionData 
      });
      
      const subscription = await subscriptionService.createSubscription(userId, subscriptionData, context);
      
      return reply.status(201).send({
        subscription,
        message: 'Subscription created successfully'
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to create subscription'
      });
    }
  });
  
  // Update a subscription
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
          name: { type: 'string', maxLength: 100 },
          description: { type: 'string' },
          prompts: { 
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          },
          frequency: { type: 'string', enum: ['immediate', 'daily'] },
          active: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: subscriptionSchema,
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const updateData = request.body;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'updateSubscription'
    };
    
    try {
      logRequest(context, 'Updating subscription', { 
        userId,
        subscriptionId: id,
        updateData
      });
      
      const subscription = await subscriptionService.updateSubscription(userId, id, updateData, context);
      
      return reply.send({
        subscription,
        message: 'Subscription updated successfully'
      });
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to update subscription'
      });
    }
  });
  
  // Process a subscription manually
  fastify.post('/:id/process', {
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
            message: { type: 'string' },
            processingId: { type: 'string' },
            subscriptionId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'processSubscription'
    };
    
    try {
      logRequest(context, 'Processing subscription manually', { 
        userId,
        subscriptionId: id
      });
      
      const result = await subscriptionService.processSubscription(userId, id, context);
      
      return reply.send(result);
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to process subscription'
      });
    }
  });
  
  // Delete a subscription
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
            message: { type: 'string' },
            id: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const context = { 
      requestId: request.id,
      service: 'Subscription',
      method: 'deleteSubscription'
    };
    
    try {
      logRequest(context, 'Deleting subscription', { 
        userId,
        subscriptionId: id
      });
      
      const result = await subscriptionService.deleteSubscription(userId, id, context);
      
      return reply.send(result);
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      
      return reply.status(500).send({
        error: 'SERVER_ERROR',
        message: 'Failed to delete subscription'
      });
    }
  });
}