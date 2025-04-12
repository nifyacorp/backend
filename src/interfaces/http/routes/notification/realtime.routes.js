import { validateZod } from '../../../../shared/utils/validation.js';
import { realtimeNotificationSchema } from '../../../../schemas/notification/index.js';

/**
 * Realtime notification routes
 * Handles WebSocket notification delivery
 */
export async function realtimeRoutes(fastify, options) {
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
      const socketManager = require('../../../../../utils/socket-manager.js');
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

  /**
   * POST /broadcast - Broadcast a notification to multiple users
   */
  fastify.post('/broadcast', {
    schema: {
      body: {
        type: 'object',
        required: ['userIds', 'notification'],
        properties: {
          userIds: { 
            type: 'array',
            items: { type: 'string' }
          },
          notification: { 
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              entityType: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'normal', 'high'] }
            },
            required: ['title', 'content']
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            delivered: { type: 'integer' },
            total: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { userIds, notification } = request.body;
    
    try {
      // Use the socket manager to broadcast the notification
      const socketManager = require('../../../../../utils/socket-manager.js');
      let deliveredCount = 0;
      
      // Loop through each user and attempt delivery
      for (const userId of userIds) {
        const delivered = socketManager.sendToUser(userId, 'notification', notification);
        if (delivered) deliveredCount++;
      }
      
      return {
        success: true,
        delivered: deliveredCount,
        total: userIds.length
      };
    } catch (error) {
      console.error('Failed to broadcast notification', {
        error: error.message,
        userCount: userIds.length
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to broadcast notification',
        message: error.message
      });
    }
  });
}

export default realtimeRoutes; 