import { query } from '../config/database.js';

// Helper to create structured log entries
function createLogEntry(step, details) {
  return {
    service: 'subscription-service',
    endpoint: 'GET /subscriptions',
    step,
    timestamp: new Date().toISOString(),
    ...details
  };
}

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
      // Debug full request state
      const requestDebug = {
        headers: {
          ...request.headers,
          authorization: request.headers.authorization ? '[REDACTED]' : undefined
        },
        user: request.user,
        userId: request.user?.id,
        requestId: request.id,
        timestamp: new Date().toISOString()
      };
      
      console.log('📦 Subscription Request Debug:', requestDebug);
      console.log('🔍 User Context Check:', {
        hasUser: !!request.user,
        userId: request.user?.id,
        headerUserId: request.headers['x-user-id'],
        timestamp: new Date().toISOString()
      });

      console.log(createLogEntry('start', {
        requestId: request.id,
        hasUser: !!request.user,
        hasUserId: !!request.user?.id
      }));

      if (!request.user) {
        console.log(createLogEntry('error', {
          requestId: request.id,
          headers: Object.keys(request.headers),
          error: 'no_user_object',
          message: 'No user object in request'
        }));
        reply.code(401).send({ error: 'Unauthorized - No user object' });
        return;
      }

      if (!request.user.id) {
        console.log(createLogEntry('error', {
          requestId: request.id,
          user: request.user,
          headers: Object.keys(request.headers),
          error: 'no_user_id',
          message: 'No user ID in request'
        }));
        reply.code(401).send({ error: 'Unauthorized - No user ID' });
        return;
      }

      console.log(createLogEntry('database_query_start', {
        requestId: request.id,
        userId: request.user.id
      }));

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

      console.log(createLogEntry('database_query_complete', {
        requestId: request.id,
        userId: request.user.id,
        rowCount: result.rows.length
      }));

      return { subscriptions: result.rows };
    } catch (error) {
      console.log(createLogEntry('error', {
        requestId: request.id,
        userId: request.user?.id,
        error: error.code || 'unknown_error',
        message: error.message,
        stack: error.stack
      }));
      request.log.error('Failed to fetch subscriptions:', error);
      throw error;
    }
  });
}