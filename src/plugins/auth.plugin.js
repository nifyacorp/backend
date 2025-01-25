import { authenticate } from '../middleware/auth.middleware.js';

export async function authPlugin(fastify, options) {
  // Decorate request with user property
  fastify.decorateRequest('user', null);
  
  // Add authentication hook
  fastify.addHook('preHandler', authenticate);
}