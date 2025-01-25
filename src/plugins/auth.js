import { query } from '../config/database.js';
import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health') {
      return;
    }

    console.log('🔒 Auth check:', {
      url: request.url,
      hasAuthHeader: !!request.headers.authorization,
      timestamp: new Date().toISOString()
    });

    try {
      // Step 1: Get token from header
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        console.log('❌ Missing or invalid Bearer token');
        throw { code: 'NO_TOKEN', message: 'Valid Bearer token required' };
      }
      const token = authHeader.slice(7);
      console.log('✅ Bearer token extracted');

      // Step 2: Verify JWT and get user ID
      const decoded = await verifyToken(token);
      console.log('🔑 Token verification:', {
        hasSub: !!decoded.sub,
        type: decoded.type,
        timestamp: new Date().toISOString()
      });

      if (!decoded.sub) {
        console.log('❌ Token missing sub claim');
        throw { code: 'INVALID_TOKEN', message: 'Token missing user ID' };
      }

      // Step 3: Check if user exists
      console.log('👤 Checking user in database:', {
        userId: decoded.sub,
        timestamp: new Date().toISOString()
      });

      const result = await query(
        'SELECT id FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (result.rows.length === 0) {
        console.log('❌ User not found in database:', {
          userId: decoded.sub,
          timestamp: new Date().toISOString()
        });
        throw { code: 'USER_NOT_FOUND', message: 'User not found in database' };
      }

      // Step 4: Set user on request
      request.user = { id: result.rows[0].id };
      console.log('✅ User authenticated:', {
        userId: request.user.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Authentication error:', {
        code: error.code,
        message: error.message,
        url: request.url,
        timestamp: new Date().toISOString()
      });

      const response = {
        error: 'Unauthorized',
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed'
      };

      reply.code(401).send(response);
    }
  });
}