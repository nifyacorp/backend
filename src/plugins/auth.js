import { query } from '../config/database.js';
import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new Error('No authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Verify JWT token
      const decoded = verifyToken(token);

      // Verify the user exists in our database
      const result = await query(
        'SELECT id FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      request.user = { id: result.rows[0].id };
    } catch (error) {
      console.error('Authentication error:', error.message);
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}