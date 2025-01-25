import { subscriptionService } from '../../../core/subscription/subscription.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

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
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      logRequest(context, 'Processing subscription request', {
        hasUser: !!request.user,
        userId: request.user?.id,
        timestamp: new Date().toISOString()
      });

      if (!request.user?.id) {
        logError(context, new Error('No user ID in request'), {
          user: request.user,
          timestamp: new Date().toISOString()
        });
        throw new AppError(
          'UNAUTHORIZED',
          'No user ID available',
          401
        );
      }

      const subscriptions = await subscriptionService.getUserSubscriptions(
        request.user.id,
        context
      );
      
      return { subscriptions };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(error.status || 500).send(response);
      return reply;
    }
  });
}