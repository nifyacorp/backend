import notificationController from '../../../core/notification/interfaces/http/notification-controller.js';

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
          subscriptionId: { type: 'string' }
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
    }
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
    }
  }, notificationController.markAsRead);

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
} 