import { query } from '../config/database.js';

export async function healthRoutes(fastify, options) {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await query('SELECT 1');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      };
    } catch (error) {
      fastify.log.error(error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected'
      };
    }
  });
}