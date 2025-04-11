import notificationController from '../../../core/notification/interfaces/http/notification-controller.js';
import { validateZod } from '../../../shared/utils/validation.js';
import {
  notificationQuerySchema,
  notificationIdParamSchema,
  activityQuerySchema,
  realtimeNotificationSchema
} from '../../../schemas/notification/index.js';

/**
 * Notification routes for Fastify
 */
export async function notificationRoutes(fastify, options) {
  /**
   * Get notifications for authenticated user
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
   * Mark notification as read
   */
  fastify.post('/:notificationId/read', {
    schema: {
      params: {
        type: 'object',
        properties: {
          notificationId: { type: 'string' }
        },
        required: ['notificationId']
      }
    },
    preHandler: validateZod(notificationIdParamSchema, 'params')
  }, notificationController.markAsRead);
  
  /**
   * Get notification statistics
   */
  fastify.get('/stats', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            unread: { type: 'integer' },
            change: { type: 'integer' },
            isIncrease: { type: 'boolean' },
            byType: { type: 'object', additionalProperties: { type: 'integer' } }
          }
        }
      }
    }
  }, notificationController.getNotificationStats);
  
  /**
   * Get notification activity statistics
   */
  fastify.get('/activity', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', default: 7 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            activityByDay: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  day: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            },
            sources: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  count: { type: 'integer' },
                  color: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: validateZod(activityQuerySchema, 'query')
  }, notificationController.getActivityStats);

  /**
   * Get notifications by entity type
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
   * Mark all notifications as read
   */
  fastify.post('/read-all', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' }
        }
      }
    }
  }, notificationController.markAllAsRead);

  /**
   * Delete a notification
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
    }
  }, notificationController.deleteNotification);

  /**
   * Delete all notifications
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

  /**
   * POST /realtime - Send realtime notification via WebSocket
   * This endpoint is called by the notification-worker to trigger WebSocket notifications
   */
  fastify.post('/realtime', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'notification'],
        properties: {
          userId: { type: 'string' },
          notificationId: { type: 'string' },
          notification: { 
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' },
              sourceUrl: { type: 'string' },
              entity_type: { type: 'string' },
              subscription_id: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            delivered: { type: 'boolean' },
            connectionCount: { type: 'integer' }
          }
        }
      }
    },
    preHandler: validateZod(realtimeNotificationSchema)
  }, async (request, reply) => {
    const { userId, notificationId, notification } = request.body;
    
    const context = {
      requestId: request.id,
      service: 'WebSocket', 
      method: 'realtime-notification'
    };
    
    try {
      // Use the socket manager to send notification to the user
      const socketManager = require('../../../../utils/socket-manager.js');
      const connectionCount = socketManager?.getConnectionsByUserId?.(userId)?.length || 0;
      let delivered = false;
      
      if (connectionCount > 0) {
        delivered = socketManager.sendToUser(userId, 'notification', notification);
        
        console.log('Sent notification via WebSocket', {
          userId,
          notificationId,
          connectionCount,
          delivered
        });
      } else {
        console.log('No active WebSocket connections for user', {
          userId,
          notificationId
        });
      }
      
      return {
        success: true,
        delivered,
        connectionCount
      };
    } catch (error) {
      console.error('Failed to send notification via WebSocket', {
        error: error.message,
        userId,
        notificationId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to send notification via WebSocket',
        message: error.message
      });
    }
  });
}