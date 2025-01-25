import { authenticate } from '../middleware/auth.middleware.js';

export async function authPlugin(fastify, options) {
  // Decorate request with user object
  fastify.decorateRequest('user', {});
  
  // Register preHandler hook for authentication
  fastify.addHook('preHandler', async (request, reply) => {
    console.log('🔒 Auth plugin hook:', {
      path: request.url,
      hasUser: !!request.user,
      timestamp: new Date().toISOString()
    });
    
    return authenticate(request, reply);
  });
}