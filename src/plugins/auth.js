import { query } from '../config/database.js';
import { verifyToken } from '../config/auth.js';

function extractToken(authHeader) {
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  return authHeader.replace('Bearer ', '');
}

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      // Log incoming request auth details
      console.log('🔒 Auth check:', {
        hasAuthHeader: !!request.headers.authorization,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });

      const authHeader = request.headers.authorization;
      const token = extractToken(authHeader);

      // Verify JWT token
      const decoded = verifyToken(token);

      // Log decoded token info (excluding sensitive data)
      console.log('🔑 Token verification:', {
        hasSub: !!decoded.sub,
        tokenType: decoded.type,
        timestamp: new Date().toISOString()
      });

      if (!decoded.sub) {
        console.log('❌ Token missing sub claim:', {
          decodedKeys: Object.keys(decoded),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid token: missing sub claim');
      }

      // Verify the user exists in our database
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
        throw new Error('User not found');
      }

      request.user = { id: result.rows[0].id };
    } catch (error) {
      console.error('❌ Authentication error:', {
        error: error.message,
        stack: error.stack,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}