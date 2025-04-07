import { FastifyInstance } from 'fastify';
import { NotificationController } from './controllers/NotificationController';

/**
 * Notification routes
 */
export default async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  // Create controller instance
  const controller = new NotificationController(fastify.notificationService);
  
  // Apply authentication to all routes
  const authenticate = fastify.requireAuth();
  
  // Register routes
  fastify.get('/notifications', {
    preHandler: authenticate,
    handler: controller.getByUser.bind(controller),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          sortBy: { type: 'string' },
          sortDirection: { type: 'string', enum: ['asc', 'desc'] },
          status: { type: 'string' },
          type: { type: 'string' },
          isUnread: { type: 'boolean' },
          subscriptionId: { type: 'string' }
        }
      }
    }
  });
  
  fastify.get('/notifications/statistics', {
    preHandler: authenticate,
    handler: controller.getStatistics.bind(controller)
  });
  
  fastify.get('/notifications/activity', {
    preHandler: authenticate,
    handler: controller.getActivity.bind(controller),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  });
  
  fastify.get('/notifications/entity', {
    preHandler: authenticate,
    handler: controller.getByEntity.bind(controller),
    schema: {
      querystring: {
        type: 'object',
        required: ['entityId'],
        properties: {
          entityId: { type: 'string' },
          entityType: { type: 'string' }
        }
      }
    }
  });
  
  fastify.get('/notifications/:id', {
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
  
  fastify.get('/subscriptions/:subscriptionId/notifications', {
    preHandler: authenticate,
    handler: controller.getBySubscription.bind(controller),
    schema: {
      params: {
        type: 'object',
        required: ['subscriptionId'],
        properties: {
          subscriptionId: { type: 'string' }
        }
      },
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
  
  fastify.post('/notifications', {
    preHandler: authenticate,
    handler: controller.create.bind(controller),
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'title', 'content', 'type'],
        properties: {
          userId: { type: 'string' },
          subscriptionId: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', enum: ['boe', 'real_estate', 'doga', 'system'] },
          metadata: { type: 'object' },
          entityId: { type: 'string' },
          entityType: { type: 'string' },
          priority: { type: 'number' }
        }
      }
    }
  });
  
  fastify.post('/notifications/bulk', {
    preHandler: authenticate,
    handler: controller.createBulk.bind(controller),
    schema: {
      body: {
        type: 'object',
        required: ['notifications'],
        properties: {
          notifications: {
            type: 'array',
            items: {
              type: 'object',
              required: ['userId', 'title', 'content', 'type'],
              properties: {
                userId: { type: 'string' },
                subscriptionId: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                type: { type: 'string', enum: ['boe', 'real_estate', 'doga', 'system'] },
                metadata: { type: 'object' },
                entityId: { type: 'string' },
                entityType: { type: 'string' },
                priority: { type: 'number' }
              }
            }
          }
        }
      }
    }
  });
  
  fastify.put('/notifications/:id/read', {
    preHandler: authenticate,
    handler: controller.markAsRead.bind(controller),
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
  
  fastify.put('/notifications/:id/unread', {
    preHandler: authenticate,
    handler: controller.markAsUnread.bind(controller),
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
  
  fastify.post('/notifications/mark-all-read', {
    preHandler: authenticate,
    handler: controller.markAllAsRead.bind(controller),
    schema: {
      body: {
        type: 'object',
        properties: {
          ids: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  });
  
  fastify.delete('/notifications/:id', {
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
  
  fastify.delete('/notifications', {
    preHandler: authenticate,
    handler: controller.deleteAll.bind(controller)
  });
}