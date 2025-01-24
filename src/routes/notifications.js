import { query } from '../config/database.js';

export async function notificationRoutes(fastify, options) {
  // Get notification counts by type
  fastify.get('/count', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            counts: {
              type: 'object',
              properties: {
                boe: { type: 'integer' },
                real_estate: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT 
          s.type,
          COUNT(*) as count
        FROM notifications n
        JOIN subscriptions s ON n.subscription_id = s.id
        WHERE n.user_id = $1 AND n.read = false
        GROUP BY s.type`,
        [request.user.id]
      );

      const counts = {
        boe: 0,
        real_estate: 0
      };

      result.rows.forEach(row => {
        counts[row.type] = parseInt(row.count);
      });

      return { counts };
    } catch (error) {
      request.log.error('Failed to fetch notification counts:', error);
      throw error;
    }
  });

  // Get recent notifications
  fastify.get('/recent', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 3 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  subscription_id: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['boe', 'real-estate'] },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  read: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { limit = 3 } = request.query;

    try {
      const result = await query(
        `SELECT 
          n.id,
          n.subscription_id,
          s.type,
          n.title,
          n.content,
          n.read,
          n.created_at
        FROM notifications n
        JOIN subscriptions s ON n.subscription_id = s.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2`,
        [request.user.id, limit]
      );

      return { notifications: result.rows };
    } catch (error) {
      request.log.error('Failed to fetch recent notifications:', error);
      throw error;
    }
  });
}