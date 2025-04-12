import { authenticate } from '../middleware/auth.middleware.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

// This plugin handles compatibility for /api/v1/me endpoints, forwarding them
// or providing direct handlers that were previously mixed in index.js.
// It also handles the associated email preference routes.

// --- User Service Wrapper ---
// This function acts as a wrapper to fetch user profile, similar to the one in index.js
// Ideally, this logic should reside within the actual user controller/handler,
// but kept here for now to minimize initial changes during refactoring.
async function userServiceWrapper(request, reply) {
  const { userService } = await import('../../../core/user/user.service.js'); // Adjust path as needed
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method,
    token: request.user?.token
  };

  try {
    logRequest(context, 'Processing user profile request from compatibility layer', {
      userId: request.user?.id
    });

    if (!request.user?.id) {
      throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
    }

    const profile = await userService.getUserProfile(request.user.id, context);
    return { profile };

  } catch (error) {
    logError(context, error);
    const status = error instanceof AppError ? error.status : 500;
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred processing user profile',
      status: 500,
    };
    reply.code(status).send(response);
    return reply; // Prevent Fastify from sending its own response
  }
}

// --- User Profile Update Handler ---
// Direct handler for PATCH /api/v1/me
async function updateUserProfileHandler(request, reply) {
  const { userService } = await import('../../../core/user/user.service.js'); // Adjust path
  const context = { requestId: request.id, path: request.url, method: request.method, token: request.user?.token };

  try {
    logRequest(context, 'Processing direct profile update request via compat layer', {
      userId: request.user?.id,
      updateFields: Object.keys(request.body)
    });

    if (!request.user?.id) {
      throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
    }

    const profile = await userService.updateUserProfile(request.user.id, request.body, context);
    return { profile };

  } catch (error) {
    logError(context, error);
    const status = error instanceof AppError ? error.status : 500;
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR', message: 'An unexpected error occurred updating profile', status: 500,
    };
    reply.code(status).send(response);
    return reply;
  }
}

// --- Notification Settings Update Handler ---
// Direct handler for PATCH /api/v1/me/notification-settings
async function updateNotificationSettingsHandler(request, reply) {
    const { userService } = await import('../../../core/user/user.service.js'); // Adjust path
    const context = { requestId: request.id, path: request.url, method: request.method, token: request.user?.token };

    try {
      logRequest(context, 'Processing direct notification settings update via compat layer', {
        userId: request.user?.id,
        updateFields: Object.keys(request.body)
      });

      if (!request.user?.id) {
        throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
      }

      const settings = await userService.updateNotificationSettings(request.user.id, request.body, context);
      return { settings };

    } catch (error) {
      logError(context, error);
      const status = error instanceof AppError ? error.status : 500;
      const response = error instanceof AppError ? error.toJSON() : {
        error: 'INTERNAL_ERROR', message: 'Failed to process notification settings update', status: 500,
      };
      reply.code(status).send(response);
      return reply;
    }
}

// --- Email Preferences Handlers (Imported) ---
// Import the handlers from the new location
let emailPrefHandlers = {};
try {
   emailPrefHandlers = await import('../../../core/user/interfaces/http/email-preferences.controller.js');
   console.log('Successfully imported email preferences controllers');
} catch (error) {
   console.error("Failed to import email preference controllers:", error);
   // Define dummy handlers to prevent server crash if import fails
   emailPrefHandlers = {
       getEmailPreferences: async (req, rep) => {
         console.error('Using fallback email preferences handler');
         return rep.code(500).send({error: "Email preferences unavailable", details: "Controller import failed"});
       },
       updateEmailPreferences: async (req, rep) => rep.code(500).send({error: "Email preferences unavailable", details: "Controller import failed"}),
       sendTestEmail: async (req, rep) => rep.code(500).send({error: "Email preferences unavailable", details: "Controller import failed"}),
   }
}
const { getEmailPreferences, updateEmailPreferences, sendTestEmail } = emailPrefHandlers;


// --- Route Registration ---
export async function compatibilityRoutes(fastify, options) {
  // Apply authentication middleware to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // --- /api/v1/me Routes ---
  // Redirect to proper user routes
  fastify.get('/api/v1/me', async (request, reply) => {
    return reply.redirect(301, '/api/v1/users/me');
  });

  fastify.patch('/api/v1/me', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me');
  });

  fastify.patch('/api/v1/me/notification-settings', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me/notification-settings');
  });

  // --- Email Preferences Routes ---
  fastify.get('/api/v1/me/email-preferences', async (request, reply) => {
    return reply.redirect(301, '/api/v1/users/me/email-preferences');
  });

  fastify.patch('/api/v1/me/email-preferences', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me/email-preferences');
  });

  fastify.post('/api/v1/me/test-email', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me/test-email');
  });

  // --- Compatibility for frontend using /v1 instead of /api/v1 ---
  fastify.get('/v1/me', async (request, reply) => {
    return reply.redirect(301, '/api/v1/users/me');
  });

  fastify.get('/v1/me/email-preferences', async (request, reply) => {
    return reply.redirect(301, '/api/v1/users/me/email-preferences');
  });

  fastify.patch('/v1/me/email-preferences', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me/email-preferences');
  });

  fastify.post('/v1/me/test-email', async (request, reply) => {
    return reply.redirect(308, '/api/v1/users/me/test-email');
  });

  console.log("Compatibility redirects registered successfully.");
} 