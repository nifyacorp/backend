import { FastifyInstance } from 'fastify';
import { SubscriptionController } from './controllers/SubscriptionController';

/**
 * Subscription routes
 */
export default async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  // Create controller instance
  const controller = new SubscriptionController(fastify.subscriptionService);
  
  // Apply authentication to all routes
  const authenticate = fastify.requireAuth();
  
  // Register routes
  fastify.get('/subscriptions', {
    preHandler: authenticate,
    handler: controller.getByUser.bind(controller),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          sortBy: { type: 'string' },
          sortDirection: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  });
  
  fastify.get('/subscriptions/search', {
    preHandler: authenticate,
    handler: controller.search.bind(controller),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          type: { type: 'string' },
          search: { type: 'string' },
          createdAfter: { type: 'string', format: 'date-time' },
          createdBefore: { type: 'string', format: 'date-time' },
          page: { type: 'number' },
          limit: { type: 'number' },
          sortBy: { type: 'string' },
          sortDirection: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  });
  
  fastify.get('/subscriptions/shared', {
    preHandler: authenticate,
    handler: controller.getShared.bind(controller)
  });
  
  fastify.get('/subscriptions/:id', {
    preHandler: authenticate,
    handler: controller.getById.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  });
  
  fastify.post('/subscriptions', {
    preHandler: authenticate,
    handler: controller.create.bind(controller),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'filters'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['boe', 'real_estate', 'doga'] },
          filters: { type: 'object' },
          templateId: { type: 'string' }
        }
      }
    }
  });
  
  fastify.put('/subscriptions/:id', {
    preHandler: authenticate,
    handler: controller.update.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused', 'inactive', 'pending'] },
          filters: { type: 'object' },
          templateId: { type: 'string' }
        }
      }
    }
  });
  
  fastify.delete('/subscriptions/:id', {
    preHandler: authenticate,
    handler: controller.delete.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  });
  
  fastify.put('/subscriptions/:id/pause', {
    preHandler: authenticate,
    handler: controller.pause.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  });
  
  fastify.put('/subscriptions/:id/resume', {
    preHandler: authenticate,
    handler: controller.resume.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  });
  
  fastify.post('/subscriptions/:id/share', {
    preHandler: authenticate,
    handler: controller.share.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['targetUserId'],
        properties: {
          targetUserId: { type: 'string' }
        }
      }
    }
  });
  
  fastify.delete('/subscriptions/:id/share', {
    preHandler: authenticate,
    handler: controller.unshare.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['targetUserId'],
        properties: {
          targetUserId: { type: 'string' }
        }
      }
    }
  });
}