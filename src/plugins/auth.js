import { query } from '../config/database.js';
import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health') {
      return;
    }

    try {
      // Step 1: Get token from header
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw { code: 'NO_TOKEN', message: 'Valid Bearer token required' };
      }
      const token = authHeader.slice(7);

      // Step 2: Verify JWT and get user ID
      const decoded = await verifyToken(token);
      if (!decoded.sub) {
        throw { code: 'INVALID_TOKEN', message: 'Token missing user ID' };
      }

      // Step 3: Check if user exists
      const result = await query(
        'SELECT id FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (result.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', message: 'User not found in database' };
      }

      // Step 4: Set user on request
      request.user = { id: result.rows[0].id };
    } catch (error) {
      const response = {
        error: 'Unauthorized',
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed'
      };

      reply.code(401).send(response);
    }
  });
}