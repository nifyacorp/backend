import { userService } from '../../../core/user/user.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { USER_PREFERENCES } from '../../../core/types/user.types.js';
import { validateZod } from '../../../shared/utils/validation.js';
import { 
  updateProfileSchema, 
  emailPreferencesSchema,
  testEmailSchema,
  userProfileResponseSchema
} from '../../../schemas/user/index.js';
import {
  getEmailPreferences,
  updateEmailPreferences,
  sendTestEmail,
  markNotificationsAsSent
} from '../../../core/user/interfaces/http/email-preferences.controller.js';
import { query } from '../../../infrastructure/database/client.js';

// API key middleware for service-to-service authentication
const validateApiKey = async (request, reply) => {
  try {
    const apiKey = request.headers['x-api-key'];
    
    // Get the expected API key from Secret Manager
    let expectedApiKey = process.env.SERVICE_API_KEY;
    
    // If not in env, try to get it from Secret Manager
    if (!expectedApiKey) {
      try {
        // Check if we have access to Secret Manager and the secret exists
        const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
        const secretClient = new SecretManagerServiceClient();
        
        // Format of the secret name: projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION
        const secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/SYNC_USERS_API_KEY/versions/latest`;
        
        const [version] = await secretClient.accessSecretVersion({ name: secretName });
        expectedApiKey = version.payload.data.toString();
      } catch (secretError) {
        console.warn('Failed to get SYNC_USERS_API_KEY from Secret Manager:', secretError.message);
        console.warn('API key validation is disabled.');
        return; // Continue without validation in case of error
      }
    }
    
    if (!expectedApiKey) {
      console.warn('Neither SERVICE_API_KEY nor SYNC_USERS_API_KEY in Secret Manager is set. API key validation is disabled.');
      return;
    }
    
    if (!apiKey || apiKey !== expectedApiKey) {
      throw new AppError(
        'UNAUTHORIZED',
        'Invalid API key',
        401
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error validating API key:', error);
    throw new AppError(
      'INTERNAL_ERROR',
      'Error validating API key',
      500
    );
  }
};

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
  // User synchronization endpoint (service-to-service)
  fastify.post('/sync', {
    schema: {
      description: 'Synchronize a Firebase user with the backend database',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['userId', 'email']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            userId: { type: 'string' }
          }
        }
      },
      security: [{ apiKey: [] }]
    },
    preHandler: validateApiKey
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      source: 'auth-service'
    };

    try {
      const { userId, email } = request.body;
      
      if (!userId || !email) {
        return reply.code(400).send({
          error: 'INVALID_REQUEST',
          message: 'User ID and email are required'
        });
      }
      
      logRequest(context, 'Processing user sync request', {
        userId,
        email
      });
      
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      
      if (existingUser.rows.length > 0) {
        // User already exists, no need to sync
        return {
          success: true,
          message: 'User already exists',
          userId
        };
      }
      
      // Create user with Firebase UID as primary key
      await query(
        `INSERT INTO users (
          id,
          email,
          display_name,
          metadata
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING`,
        [
          userId, // Using Firebase UID directly as the primary key
          email,
          email.split('@')[0], // Simple display name from email
          JSON.stringify({
            profile: {
              bio: "",
              interests: []
            },
            preferences: {
              language: "es",
              theme: "light"
            },
            notifications: {
              email: {
                enabled: true,
                useCustomEmail: false,
                customEmail: null,
                digestTime: "08:00"
              }
            },
            security: {
              lastPasswordChange: null,
              lastLogoutAllDevices: null
            },
            // Keep these fields for backward compatibility
            emailNotifications: true,
            emailFrequency: "daily",
            instantNotifications: true,
            notificationEmail: email
          })
        ]
      );
      
      // Confirm user was created
      const checkUserCreated = await query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      
      if (checkUserCreated.rows.length === 0) {
        throw new Error('Failed to create user');
      }
      
      // Log success
      console.log(`User ${userId} successfully synced to backend database`);
      
      return {
        success: true,
        message: 'User successfully synced',
        userId
      };
      
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });
  
  // User profile endpoint
  fastify.get('/profile', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            profile: { $ref: 'userProfileResponseSchema#' }
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

  // Update user profile endpoint (now handles all settings)
  fastify.patch('/profile', {
    schema: {
      description: 'Update user profile, preferences, and notification settings',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          first_name: { type: 'string', maxLength: 255 },
          last_name: { type: 'string', maxLength: 255 },
          avatar: { type: 'string', format: 'uri', nullable: true },
          bio: { type: 'string', maxLength: 500 },
          theme: { type: 'string', enum: USER_PREFERENCES.THEMES },
          language: { type: 'string', enum: USER_PREFERENCES.LANGUAGES },
          notification_settings: {
            type: 'object',
            properties: {
              emailNotifications: { type: 'boolean' },
              notificationEmail: { type: 'string', format: 'email', nullable: true },
              useCustomEmail: { type: 'boolean' },
              emailFrequency: { type: 'string', enum: ['daily'] },
              instantNotifications: { type: 'boolean' },
              digestTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }
            },
            additionalProperties: true
          }
        },
        additionalProperties: true
      },
      response: {
        200: {
          description: 'Successful update',
          type: 'object',
          properties: {
            profile: { $ref: 'userProfileResponseSchema#' }
          }
        }
      }
    },
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.user?.token
    };

    try {
      logRequest(context, 'Processing comprehensive profile update request', {
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

      // Call the updated userService.updateUserProfile
      const profile = await userService.updateUserProfile(
        request.user.id,
        request.body, // Pass the full body containing all updates
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
  
  // Notification settings endpoint - REMOVED
  // fastify.patch('/notification-settings', { ... });
  
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

  // Profile picture upload endpoint
  fastify.post('/profile/picture', {
    schema: {
      description: 'Upload a profile picture',
      tags: ['Users'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          description: 'Successful upload',
          type: 'object',
          properties: {
            profile: { $ref: 'userProfileResponseSchema#' }
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
      logRequest(context, 'Processing profile picture upload', {
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
      
      // Parse the multipart form data
      const data = await request.file();
      
      if (!data) {
        throw new AppError(
          'INVALID_REQUEST',
          'No file uploaded',
          400
        );
      }
      
      // Validate file type
      const contentType = data.mimetype;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (!allowedTypes.includes(contentType)) {
        throw new AppError(
          'INVALID_FILE_TYPE',
          `File type ${contentType} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          400
        );
      }
      
      // Get the file buffer
      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      
      // Validate file size (max 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new AppError(
          'FILE_TOO_LARGE',
          `File size (${fileBuffer.length} bytes) exceeds maximum allowed size (${MAX_FILE_SIZE} bytes)`,
          400
        );
      }
      
      // Upload profile picture
      const profile = await userService.uploadProfilePicture(
        request.user.id,
        fileBuffer,
        data.filename,
        contentType,
        context
      );
      
      return { profile };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });
  
  // Delete profile picture endpoint
  fastify.delete('/profile/picture', {
    schema: {
      description: 'Delete the current profile picture',
      tags: ['Users'],
      response: {
        200: {
          description: 'Successful deletion',
          type: 'object',
          properties: {
            profile: { $ref: 'userProfileResponseSchema#' }
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
      logRequest(context, 'Processing profile picture deletion', {
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
      
      // Delete profile picture
      const profile = await userService.deleteProfilePicture(
        request.user.id,
        context
      );
      
      return { profile };
    } catch (error) {
      logError(context, error);
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        status: 500,
        timestamp: new Date().toISOString()
      };
      reply.code(response.status).send(response);
      return reply;
    }
  });

  // Register the schemas
  userProfileResponseSchema.$id = 'userProfileResponseSchema';
  fastify.addSchema(updateProfileSchema);
  fastify.addSchema(userProfileResponseSchema);
}