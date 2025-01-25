import { query } from '../config/database.js';
import { verifyToken } from '../config/auth.js';

function extractToken(authHeader) {
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') {
    throw new Error('Invalid authorization type');
  }
  return token;
}

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      console.log('🔒 Processing authentication:', {
        hasAuthHeader: !!request.headers.authorization,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });

      // Extract and verify token
      try {
        const token = extractToken(request.headers.authorization);
        const decoded = await verifyToken(token);

        if (!decoded.sub) {
          throw new Error('Invalid token: missing sub claim');
        }

        // Verify user exists in database
        const result = await query(
          'SELECT id FROM users WHERE id = $1',
          [decoded.sub]
        );

        if (result.rows.length === 0) {
          throw new Error('User not found');
        }

        // Set user on request
        request.user = { id: result.rows[0].id };

        console.log('✅ Authentication successful:', {
          userId: request.user.id,
          path: request.url,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Token verification failed:', {
          error: error.message,
          path: request.url,
          timestamp: new Date().toISOString()
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Authentication error:', {
        error: error.message,
        type: error.name,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });
      reply.code(401).send({ 
        error: 'Unauthorized',
        message: error.message
      });
    }
  });
}