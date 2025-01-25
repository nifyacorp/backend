import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health') return;

    try {
      // 1. Extract token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw { code: 'NO_TOKEN', message: 'Authorization token required' };
      }

      // 2. Verify token and get user
      const decoded = verifyToken(token);
      if (!decoded.sub) {
        throw { code: 'INVALID_TOKEN', message: 'Invalid token format' };
      }

      // 3. Set user context
      request.user = { id: decoded.sub };

    } catch (error) {
      reply.code(401).send({
        error: 'Unauthorized',
        code: error.code || 'AUTH_ERROR',
        message: error.message
      });
    }
  });
}