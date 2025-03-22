import { userService } from '../../../core/user/user.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { USER_PREFERENCES } from '../../../core/types/user.types.js';
import { validateZod } from '../../../shared/utils/validation.js';
import { 
  updateProfileSchema, 
  updateNotificationSettingsSchema 
} from '../../../core/user/schemas.js';
import { emailPreferencesSchema, testEmailSchema } from '../../../core/user/schemas/email-preferences.schema.js';
import {
  getEmailPreferences,
  updateEmailPreferences,
  sendTestEmail,
  markNotificationsAsSent
} from '../../../core/user/interfaces/http/email-preferences.controller.js';

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

// Using the imported updateProfileSchema from schemas.js

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
      method: request.method,
      token: request.user?.token
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
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          bio: { type: 'string', maxLength: 500 },
          theme: { type: 'string', enum: ['light', 'dark', 'system'] },
          language: { type: 'string', enum: ['es', 'en', 'ca'] }
        },
        required: [],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            profile: userProfileSchema
          }
        }
      }
    },
    preHandler: validateZod(updateProfileSchema)
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.user?.token
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
  
  // Add a dedicated endpoint for notification settings
  fastify.patch('/me/notification-settings', {
    schema: {
      body: {
        type: 'object',
        properties: {
          emailNotifications: { type: 'boolean' },
          notificationEmail: { type: 'string', format: 'email', nullable: true },
          emailFrequency: { type: 'string', enum: ['daily'] },
          instantNotifications: { type: 'boolean' }
        },
        required: [],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            settings: {
              type: 'object',
              properties: {
                emailNotifications: { type: 'boolean' },
                notificationEmail: { type: 'string', format: 'email', nullable: true },
                emailFrequency: { type: 'string', enum: ['daily'] },
                instantNotifications: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    preHandler: validateZod(updateNotificationSettingsSchema)
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.user?.token
    };

    try {
      logRequest(context, 'Processing notification settings update', {
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

      const settings = await userService.updateNotificationSettings(
        request.user.id,
        request.body,
        context
      );
      
      return { settings };
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
  
  // Email notification preferences endpoints
  fastify.get('/me/email-preferences', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            email_notifications: { type: 'boolean' },
            notification_email: { type: 'string', format: 'email', nullable: true },
            digest_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' }
          }
        }
      }
    }
  }, getEmailPreferences);
  
  fastify.patch('/me/email-preferences', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email_notifications: { type: 'boolean' },
          notification_email: { type: 'string', format: 'email', nullable: true },
          digest_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            preferences: {
              type: 'object',
              properties: {
                email_notifications: { type: 'boolean' },
                notification_email: { type: 'string', format: 'email', nullable: true },
                digest_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' }
              }
            }
          }
        }
      }
    },
    preHandler: validateZod(emailPreferencesSchema)
  }, updateEmailPreferences);
  
  // Test email endpoint
  fastify.post('/me/test-email', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        }
      }
    },
    preHandler: validateZod(testEmailSchema)
  }, sendTestEmail);
  
  // Administrative endpoint to mark notifications as sent via email
  // This requires admin or service account permissions
  fastify.post('/notifications/mark-sent', {
    schema: {
      body: {
        type: 'object',
        properties: {
          notification_ids: { 
            type: 'array',
            items: { type: 'string', format: 'uuid' }
          },
          sent_at: { type: 'string', format: 'date-time' }
        },
        required: ['notification_ids'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            updated: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, markNotificationsAsSent);
}