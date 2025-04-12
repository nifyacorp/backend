import notificationController from '../../../../core/notification/interfaces/http/notification-controller.js';
import { validateZod } from '../../../../shared/utils/validation.js';
import {
  notificationQuerySchema,
  notificationIdParamSchema
} from '../../../../schemas/notification/index.js';

/**
 * CRUD routes for notifications
 */
export async function crudRoutes(fastify, options) {
  /**
   * GET / - Get notifications for authenticated user
   * (resolves to /api/v1/notifications/ from main index.js registration)
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          unread: { type: 'boolean', default: false },
          subscriptionId: { type: 'string' },
          entityType: { type: 'string' },
          entity_type: { type: 'string' } // For backward compatibility
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
            unread: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    },
    onRequest: (request, reply, done) => {
      // Request logging for debugging notification polling issues
      console.log('Notification request received:', {
        path: request.url,
        query: request.query,
        userId: request.user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Normalize parameters for consistency
      if (request.query.entity_type && !request.query.entityType) {
        request.query.entityType = request.query.entity_type;
      }
      
      done();
    },
    preHandler: validateZod(notificationQuerySchema, 'query')
  }, notificationController.getUserNotifications);

  /**
   * GET /:notificationId - Get notification details
   */
  fastify.get('/:notificationId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          notificationId: { type: 'string' }
        },
        required: ['notificationId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            source_url: { type: 'string' },
            read: { type: 'boolean' },
            read_at: { type: ['string', 'null'], format: 'date-time' },
            entity_type: { type: 'string' },
            source: { type: ['string', 'null'] },
            data: { type: 'object' },
            metadata: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    preHandler: validateZod(notificationIdParamSchema, 'params'),
    handler: async (request, reply) => {
      try {
        const userId = request.user.id;
        const { notificationId } = request.params;
        
        console.log('Getting notification details:', {
          userId,
          notificationId
        });
        
        // Use the notification service (via controller) to find the notification
        // Since there's no specific getNotificationById method, we'll use the getUserNotifications
        // and filter for the one we want
        const notificationsResult = await notificationController.getUserNotifications({
          user: { id: userId },
          query: { 
            limit: 100,
            page: 1
          }
        }, reply);
        
        // Check if we got a direct response object
        const notificationsData = notificationsResult?.notifications || 
                                 (typeof notificationsResult === 'object' ? notificationsResult : {});
        
        // Find the specific notification
        const notification = notificationsData.notifications?.find(n => n.id === notificationId);
        
        if (!notification) {
          return reply.status(404).send({
            error: 'Notification not found',
            message: `No notification found with id ${notificationId}`
          });
        }
        
        return reply.send(notification);
      } catch (error) {
        console.error('Error fetching notification detail:', error);
        return reply.status(error.status || 500).send({
          error: 'Failed to fetch notification details',
          message: error.message
        });
      }
    }
  });

  /**
   * GET /by-entity - Get notifications by entity type
   */
  fastify.get('/by-entity', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          entityType: { type: 'string' },
          entity_type: { type: 'string' }, // For backward compatibility
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 }
        },
        required: ['entityType'] 
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
            unread: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    },
    onRequest: (request, reply, done) => {
      // Normalize parameters for compatibility
      if (request.query.entity_type && !request.query.entityType) {
        request.query.entityType = request.query.entity_type;
      }
      
      // Log for debugging
      console.log('Notification by entity request:', {
        entityType: request.query.entityType,
        path: request.url,
        query: request.query,
        userId: request.user?.id
      });
      
      done();
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const entityType = request.query.entityType;
      const page = Math.max(parseInt(request.query.page) || 1, 1);
      const limit = Math.min(parseInt(request.query.limit) || 10, 100);
      const offset = (page - 1) * limit;
      
      console.log('Processing by-entity request for:', {
        entityType,
        userId,
        page,
        limit
      });

      // Call service with entity type filter
      const result = await notificationController.getUserNotifications({
        user: { id: userId },
        query: {
          page,
          limit,
          entityType
        }
      }, reply);
      
      return result;
    } catch (error) {
      console.error('Error fetching notifications by entity:', error);
      return reply.status(error.status || 500).send({
        error: 'Failed to fetch notifications by entity',
        message: error.message
      });
    }
  });

  /**
   * DELETE /:notificationId - Delete a notification
   */
  fastify.delete('/:notificationId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          notificationId: { type: 'string' }
        },
        required: ['notificationId']
      }
    },
    config: {
      allowEmptyBody: true
    },
    preHandler: validateZod(notificationIdParamSchema, 'params')
  }, notificationController.deleteNotification);

  /**
   * DELETE /delete-all - Delete all notifications
   */
  fastify.delete('/delete-all', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' }
        }
      }
    },
    config: {
      allowEmptyBody: true
    }
  }, notificationController.deleteAllNotifications);
}

export default crudRoutes; 