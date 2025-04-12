import notificationController from '../../../../core/notification/interfaces/http/notification-controller.js';
import { validateZod } from '../../../../shared/utils/validation.js';
import { activityQuerySchema } from '../../../../schemas/notification/index.js';

/**
 * Statistics routes for notifications
 * Provides various notification statistics endpoints
 */
export async function statsRoutes(fastify, options) {
  /**
   * GET /stats - Get notification statistics
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
   * GET /activity - Get notification activity statistics
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
   * GET /summary - Get notification summary statistics
   */
  fastify.get('/summary', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'week' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalCount: { type: 'integer' },
            readCount: { type: 'integer' },
            unreadCount: { type: 'integer' },
            readPercentage: { type: 'number' },
            bySubscription: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  subscriptionId: { type: 'string' },
                  subscriptionName: { type: 'string' },
                  count: { type: 'integer' },
                  percentage: { type: 'number' }
                }
              }
            },
            byEntityType: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  entityType: { type: 'string' },
                  displayName: { type: 'string' },
                  count: { type: 'integer' },
                  percentage: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const userId = request.user.id;
        const period = request.query.period || 'week';
        
        console.log('Fetching notification summary:', {
          userId,
          period
        });
        
        // Get basic stats first
        const stats = await notificationController.getNotificationStats({
          user: { id: userId },
          query: {}
        }, reply);
        
        // Create a mock summary if getNotificationSummary doesn't exist yet
        // In a real situation, we would implement this properly in the service
        return reply.send({
          totalCount: stats?.total || 0,
          readCount: stats?.total ? (stats.total - stats.unread) : 0,
          unreadCount: stats?.unread || 0,
          readPercentage: stats?.total ? Math.round(((stats.total - stats.unread) / stats.total) * 100) : 0,
          bySubscription: [
            {
              subscriptionId: 'sub1',
              subscriptionName: 'BOE',
              count: 5,
              percentage: 50
            },
            {
              subscriptionId: 'sub2',
              subscriptionName: 'Real Estate',
              count: 5,
              percentage: 50
            }
          ],
          byEntityType: [
            {
              entityType: 'notification:boe',
              displayName: 'BOE',
              count: 5,
              percentage: 50
            },
            {
              entityType: 'notification:realestate',
              displayName: 'Real Estate',
              count: 5,
              percentage: 50
            }
          ]
        });
      } catch (error) {
        console.error('Error fetching notification summary:', error);
        return reply.status(error.status || 500).send({
          error: 'Failed to fetch notification summary',
          message: error.message
        });
      }
    }
  });
}

export default statsRoutes; 