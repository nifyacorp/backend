import { query } from '../config/database.js';

export async function subscriptionRoutes(fastify, options) {
  // Log route registration
  console.log('📝 Registering subscription routes');

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
      // Log request details
      console.log('📨 GET /subscriptions request:', {
        userId: request.user?.id,
        hasAuthHeader: !!request.headers.authorization,
        headers: {
          ...request.headers,
          authorization: request.headers.authorization ? '[REDACTED]' : undefined
        },
        timestamp: new Date().toISOString()
      });

      if (!request.user) {
        console.log('❌ No user object in request:', {
          headers: {
            ...request.headers,
            authorization: '[REDACTED]'
          },
          timestamp: new Date().toISOString()
        });
        reply.code(401).send({ error: 'Unauthorized - No user object' });
        return;
      }

      if (!request.user.id) {
        console.log('❌ No user ID in request.user:', {
          user: request.user,
          timestamp: new Date().toISOString()
        });
        reply.code(401).send({ error: 'Unauthorized - No user ID' });
        return;
      }

      console.log('🔍 Fetching subscriptions for user:', {
        userId: request.user.id,
        timestamp: new Date().toISOString()
      });

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

      console.log('✅ Successfully fetched subscriptions:', {
        userId: request.user.id,
        subscriptionCount: result.rows.length,
        timestamp: new Date().toISOString()
      });

      return { subscriptions: result.rows };
    } catch (error) {
      request.log.error('Failed to fetch subscriptions:', error);
      console.error('❌ Failed to fetch subscriptions:', {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        userId: request.user?.id,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  });
}