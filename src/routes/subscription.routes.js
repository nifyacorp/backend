import { subscriptionService } from '../services/subscription.service.js';

// Response schema
const subscriptionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['boe', 'real-estate'] },
    name: { type: 'string' },
    description: { type: 'string' },
    prompts: { 
      type: 'array',
      items: { type: 'string' }
    },
    frequency: { type: 'string', enum: ['immediate', 'daily'] },
    active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
};

export async function subscriptionRoutes(fastify, options) {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptions: {
              type: 'array',
              items: subscriptionSchema
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const subscriptions = await subscriptionService.getUserSubscriptions(request.user.id);
      return { subscriptions };
    } catch (error) {
      console.error('❌ Failed to fetch subscriptions:', {
        userId: request.user?.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  });
}