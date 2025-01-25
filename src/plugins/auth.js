import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health' || request.url.startsWith('/documentation')) {
      return;
    }
    
    // Debug full request details
    console.log('🔍 Incoming Request Debug:', {
      headers: {
        ...request.headers,
        authorization: request.headers.authorization ? '[REDACTED]' : undefined
      },
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });

    try {
      // 1. Log incoming request
      console.log('🔒 Auth check:', {
        path: request.url,
        method: request.method,
        hasAuthHeader: !!request.headers.authorization,
        hasUserIdHeader: !!request.headers['x-user-id'],
        timestamp: new Date().toISOString()
      });

      // 2. Check for required headers
      const token = request.headers.authorization?.replace('Bearer ', '');
      const userId = request.headers['x-user-id'];

      if (!token || !userId) {
        console.log('❌ Missing required headers:', {
          hasToken: !!token,
          hasUserId: !!userId,
          headers: Object.keys(request.headers),
          timestamp: new Date().toISOString()
        });
        throw { 
          code: 'MISSING_HEADERS', 
          message: 'Authorization token and x-user-id header required',
          hasToken: !!token,
          hasUserId: !!userId
        };
      }
      
      // Log detailed header information
      console.log('🔍 Auth Headers:', {
        token: token ? '[REDACTED]' : undefined,
        userId,
        allHeaders: Object.keys(request.headers),
        timestamp: new Date().toISOString()
      });

      // 3. Verify token
      const decoded = verifyToken(token);
      
      // Log token verification result
      console.log('🔑 Token verified:', {
        decodedUserId: decoded.sub,
        headerUserId: userId,
        timestamp: new Date().toISOString()
      });
      
      // 4. Set user context
      request.user = { id: userId };
      
      console.log('✅ Authentication successful:', {
        userId,
        hasUser: !!request.user,
        hasUserId: !!request.user.id,
        path: request.url,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Authentication error:', {
        code: error.code || 'AUTH_ERROR',
        message: error.message,
        path: request.url,
        timestamp: new Date().toISOString()
      });

      reply.code(401).send({
        error: 'Unauthorized',
        code: error.code || 'AUTH_ERROR',
        message: error.message
      });
    }
  });
}