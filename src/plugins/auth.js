import { verifyToken } from '../config/auth.js';

export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health') return;
    
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
      // Get user ID header case-insensitively
      const userIdKey = Object.keys(request.headers)
        .find(key => key.toLowerCase() === 'x-user-id');
      const userId = userIdKey ? request.headers[userIdKey] : null;
      
      // Debug header extraction
      console.log('🔑 Header Extraction:', {
        foundKey: userIdKey,
        extractedUserId: userId,
        allHeaderKeys: Object.keys(request.headers),
        timestamp: new Date().toISOString()
      });

      if (!token || !userId) {
        console.log('❌ Missing required headers:', {
          hasToken: !!token,
          hasUserId: !!userId,
          timestamp: new Date().toISOString()
        });
        throw { 
          code: 'MISSING_HEADERS', 
          message: 'Authorization token and x-user-id header required',
          hasToken: !!token,
          hasUserId: !!userId
        };
      }

      // 3. Verify token
      const decoded = verifyToken(token);
      
      // 4. Set user context from header before proceeding
      if (!request.user) {
        request.user = {};
      }
      request.user.id = userId;

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