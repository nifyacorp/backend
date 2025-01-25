import { query } from '../config/database.js';

export async function authRoutes(fastify, options) {
  fastify.get('/me', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                preferences: { type: 'object' },
                notification_settings: { type: 'object' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Log the request for debugging
      console.log('📨 /api/auth/me request:', {
        userId: request.user?.id,
        hasAuthHeader: !!request.headers.authorization,
        timestamp: new Date().toISOString()
      });

      const result = await query(
        'SELECT id, name, email, preferences, notification_settings, created_at, updated_at FROM users WHERE id = $1',
        [request.user.id]
      );

      if (result.rows.length === 0) {
        console.log('❌ User not found:', {
          userId: request.user.id,
          timestamp: new Date().toISOString()
        });
        reply.code(401).send({ error: 'User not found' });
        return;
      }

      console.log('✅ User profile retrieved:', {
        userId: result.rows[0].id,
        hasPreferences: !!result.rows[0].preferences,
        hasNotificationSettings: !!result.rows[0].notification_settings,
        timestamp: new Date().toISOString()
      });

      return { user: result.rows[0] };
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', {
        error: error.message,
        userId: request.user?.id,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  });
}