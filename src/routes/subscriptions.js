import { query } from '../config/database.js';

export async function subscriptionRoutes(fastify, options) {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['boe', 'real-estate'] },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  prompts: { 
                    type: 'array',
                    items: { type: 'string' }
                  },
                  frequency: { type: 'string', enum: ['immediate', 'daily'] },
                  active: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
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
          id,
          type,
          name,
          description,
          prompts,
          frequency,
          status = 'active' as active,
          created_at,
          updated_at
        FROM subscriptions 
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [request.user.id]
      );

      return { subscriptions: result.rows };
    } catch (error) {
      request.log.error('Failed to fetch subscriptions:', error);
      throw error;
    }
  });
}