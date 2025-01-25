import { userService } from '../../../core/user/user.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { USER_PREFERENCES } from '../../../core/types/user.types.js';

const userProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    avatar: { type: 'string', nullable: true },
    bio: { type: 'string', nullable: true },
    theme: { type: 'string', enum: USER_PREFERENCES.THEMES },
    language: { type: 'string', enum: USER_PREFERENCES.LANGUAGES },
    emailNotifications: { type: 'boolean' },
    notificationEmail: { type: 'string', format: 'email', nullable: true },
    lastLogin: { type: 'string', format: 'date-time' },
    emailVerified: { type: 'boolean' },
    subscriptionCount: { type: 'integer' },
    notificationCount: { type: 'integer' },
    lastNotification: { type: 'string', format: 'date-time', nullable: true }
  }
};

const updateProfileSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    bio: { type: 'string', nullable: true },
    theme: { type: 'string', enum: USER_PREFERENCES.THEMES },
    language: { type: 'string', enum: USER_PREFERENCES.LANGUAGES },
    emailNotifications: { type: 'boolean' },
    notificationEmail: { type: 'string', format: 'email', nullable: true }
  },
  additionalProperties: false
};

export async function userRoutes(fastify, options) {
  fastify.get('/me', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            profile: userProfileSchema
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
      logRequest(context, 'Processing user profile request', {
        hasUser: !!request.user,
        userId: request.user?.id
      });

      if (!request.user?.id) {
        throw new AppError(
          'UNAUTHORIZED',
          'No user ID available',
          401
        );
      }

      const profile = await userService.getUserProfile(
        request.user.id,
        context
      );
      
      return { profile };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });

  fastify.patch('/me', {
    schema: {
      body: updateProfileSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            profile: userProfileSchema
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
      logRequest(context, 'Processing profile update request', {
        hasUser: !!request.user,
        userId: request.user?.id,
        updateFields: Object.keys(request.body)
      });

      if (!request.user?.id) {
        throw new AppError(
          'UNAUTHORIZED',
          'No user ID available',
          401
        );
      }

      const profile = await userService.updateUserProfile(
        request.user.id,
        request.body,
        context
      );
      
      return { profile };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });
}