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
  if (!token) {
    throw new Error('No token provided');
  }
  return token;
}

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health') {
      return;
    }

    try {
      console.log('🔒 Processing authentication:', {
        hasAuthHeader: !!request.headers.authorization,
        authHeader: request.headers.authorization ? 'Bearer ...' : undefined,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });

      let token;
      try {
        token = extractToken(request.headers.authorization);
      } catch (error) {
        console.error('❌ Token extraction failed:', {
          error: error.message,
          path: request.url,
          timestamp: new Date().toISOString()
        });
        throw error;
      }

      // Verify JWT token
      const decoded = await verifyToken(token);

      if (!decoded.sub) {
        console.log('❌ Token missing sub claim:', {
          decodedKeys: Object.keys(decoded),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid token: missing sub claim');
      }

      // Verify user exists in database
      const result = await query(
        'SELECT id FROM users WHERE id = $1',
        [decoded.sub]
      );

      console.log('👤 User verification:', {
        userId: decoded.sub,
        found: result.rows.length > 0, 
        timestamp: new Date().toISOString()
      });

      if (result.rows.length === 0) {
        console.error('❌ User not found in database:', {
          sub: decoded.sub,
          timestamp: new Date().toISOString()
        });
        throw new Error('User not found');
      }

      request.user = { id: result.rows[0].id };

      console.log('✅ Authentication successful:', {
        userId: request.user.id,
        path: request.url,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Authentication error:', {
        error: error.message,
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