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
      const result = await query(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
        [request.user.id]
      );

      if (result.rows.length === 0) {
        reply.code(401).send({ error: 'User not found' });
        return;
      }

      return { user: result.rows[0] };
    } catch (error) {
      request.log.error('Failed to fetch user profile:', error);
      throw error;
    }
  });
}