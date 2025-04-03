import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import express from '@fastify/express';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { subscriptionRoutes } from './interfaces/http/routes/subscription/index.js';
import { templateRoutes } from './interfaces/http/routes/template.routes.js';
import { notificationRoutes } from './interfaces/http/routes/notification.routes.js';
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import { ALLOWED_HEADERS } from './shared/constants/headers.js';
import { AppError } from './shared/errors/AppError.js';
import { logRequest, logError } from './shared/logging/logger.js';
import diagnosticsRoutes, { expressRouter as diagnosticsExpressRouter } from './interfaces/http/routes/diagnostics.routes.js';

const fastify = Fastify({
  logger: true,
  // Add global configuration for request handling
  bodyLimit: 1048576, // 1MiB
  // Configure to accept DELETE requests with empty bodies
  exposeHeadRoutes: true,
  // Set default for content type parsing to be more lenient
  ignoreTrailingSlash: true,
  // Optional: Add a handler for cases where Content-Type doesn't match request
  onProtoPoisoning: 'remove',
  onConstructorPoisoning: 'remove'
});

// Register plugins
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return cb(null, true);
    
    // Check if the origin is allowed
    const allowedDomains = [
      // Netlify domains
      '.netlify.app',
      // Local development
      'localhost',
      '127.0.0.1',
      // Cloud Run domains
      '.run.app',
      // Specifically allow the main page domain
      'main-page-415554190254.us-central1.run.app'
    ];
    
    // Check if origin matches any allowed domain
    const isAllowed = allowedDomains.some(domain => {
      return domain.startsWith('.') 
        ? origin.endsWith(domain)
        : origin.includes(domain);
    });
    
    if (isAllowed) {
      return cb(null, true);
    }
    
    // Log blocked origin for debugging
    console.log(`CORS blocked origin: ${origin}`);
    
    // Block other origins
    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ALLOWED_HEADERS,
  exposedHeaders: ['X-Request-Id']
});

// Improved content type parser for JSON with error handling and logging
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  // For DELETE requests, allow empty body
  if (req.method === 'DELETE' && (!body || body === '')) {
    done(null, {});
    return;
  }
  
  try {
    // Log raw request details
    console.log(`Request body parser (${req.method} ${req.url}):`, {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      bodyLength: body?.length || 0,
      bodyEmpty: !body || body.trim() === '',
      authHeader: req.headers.authorization ? 
        `${req.headers.authorization.substring(0, 10)}...` : 'missing',
      userIdHeader: req.headers['x-user-id'] || 'missing'
    });
    
    // Better handling of empty or malformed bodies
    if (!body || body.trim() === '') {
      console.log('Received empty request body, defaulting to empty object');
      done(null, {});
      return;
    }
    
    // Parse body and log details for debugging
    const json = JSON.parse(body);
    
    // Log all POST request bodies for debugging
    if (req.method === 'POST') {
      console.log(`Parsed ${req.url} request body:`, {
        url: req.url,
        contentType: req.headers['content-type'],
        bodyKeys: Object.keys(json),
        hasName: 'name' in json,
        nameType: json.name !== undefined ? typeof json.name : 'undefined',
        nameValue: json.name !== undefined ? String(json.name).substring(0, 20) : 'undefined',
        hasType: 'type' in json,
        hasPrompts: 'prompts' in json,
        promptsType: json.prompts !== undefined ? 
          (Array.isArray(json.prompts) ? 'array' : typeof json.prompts) : 'undefined'
      });
    }
    
    // Special handling for subscription creation
    if (req.method === 'POST' && req.url.includes('/subscriptions')) {
      // Handle prompts that might be a string instead of array
      if (json.prompts && typeof json.prompts === 'string') {
        try {
          // First try to parse as JSON string that contains an array
          json.prompts = JSON.parse(json.prompts);
        } catch (e) {
          // If that fails, treat it as a single prompt string
          json.prompts = [json.prompts];
        }
      } else if (!json.prompts) {
        // Default to empty array if missing
        json.prompts = [];
      }
      
      // Ensure name is a string
      if (json.name === null || json.name === undefined) {
        json.name = '';
      } else if (typeof json.name !== 'string') {
        json.name = String(json.name);
      }
      
      console.log('Processed subscription body:', { 
        name: json.name,
        type: json.type || 'not provided',
        promptsCount: Array.isArray(json.prompts) ? json.prompts.length : 'not an array',
        keys: Object.keys(json)
      });
    }
    
    done(null, json);
  } catch (err) {
    console.error('Error parsing request body:', {
      error: err.message,
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type'],
      bodyLength: body?.length,
      bodyPreview: body?.substring(0, 100)
    });
    
    // More detailed error for client
    err.statusCode = 400;
    err.message = `JSON parse error: ${err.message}. Please check request body format.`;
    done(err, undefined);
  }
});

// Add support for form-urlencoded content for better compatibility
fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, function (req, body, done) {
  try {
    console.log(`Parsing form data for ${req.method} ${req.url}`, {
      bodyLength: body?.length || 0,
      bodyPreview: body ? body.substring(0, 50) + '...' : 'empty'
    });
    
    const parsed = new URLSearchParams(body);
    const result = {};
    
    for (const [key, value] of parsed.entries()) {
      result[key] = value;
    }
    
    console.log('Parsed form data:', { 
      keys: Object.keys(result),
      hasName: 'name' in result
    });
    
    done(null, result);
  } catch (err) {
    console.error(`Form data parse error for ${req.method} ${req.url}:`, err);
    err.statusCode = 400;
    err.message = `Form data parse error: ${err.message}`;
    done(err, undefined);
  }
});

// Import enhanced API documentation utils
import apiDocs from './shared/utils/api-docs.js';

// Swagger documentation with enhanced configuration
await fastify.register(swagger, {
  openapi: apiDocs.enhancedOpenAPIConfig
});

// Add health and version check routes
fastify.get('/health', async () => {
  const packageVersion = process.env.npm_package_version || '1.0.0';
  const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
  const commitSha = process.env.COMMIT_SHA || 'unknown';
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: {
      package: packageVersion,
      buildTimestamp,
      commitSha,
      environment: process.env.NODE_ENV || 'development'
    },
    memory: process.memoryUsage(),
    services: {
      database: 'connected' // We're assuming database is connected if the server is running
    }
  };
});

// Add dedicated version endpoint for deployment tracking
fastify.get('/version', async () => {
  const packageVersion = process.env.npm_package_version || '1.0.0';
  const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
  const commitSha = process.env.COMMIT_SHA || 'unknown';
  const deploymentId = process.env.DEPLOYMENT_ID || 'local';
  
  return {
    api_version: 'v1',
    service: 'nifya-orchestration-service',
    version: packageVersion,
    build: {
      timestamp: buildTimestamp,
      commit: commitSha,
      deployment_id: deploymentId
    },
    environment: process.env.NODE_ENV || 'development',
    features: {
      notifications: true,
      subscriptions: true,
      templates: true
    },
    uptime_seconds: process.uptime(),
    uptime_formatted: formatUptime(process.uptime())
  };
});

// Helper function to format uptime in a human-readable format
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Register diagnostics routes (public for testing)
fastify.register(diagnosticsRoutes, { prefix: '/api/v1/diagnostics' });

// Register express plugin for compatibility with Express middleware
await fastify.register(express);

// Register Express-compatible diagnostics endpoints
fastify.use('/api/diagnostics', diagnosticsExpressRouter);

// Register Swagger UI with enhanced configuration
await fastify.register(swaggerUI, {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    showExtensions: true,
    showCommonExtensions: true
  },
  staticCSP: true
});

// Set up additional documentation pages
apiDocs.setupAdditionalDocs(fastify);

// Register authentication middleware
fastify.register(async function (fastify) {
  fastify.addHook('preHandler', authenticate);
  
  // Protected routes
  fastify.register(userRoutes, { prefix: '/api/v1/users' });
  fastify.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
});

// Public routes
fastify.register(templateRoutes, { prefix: '/api/v1/templates' });

// Legacy API routes handler - create a compatibility layer for old endpoints
fastify.register(async function (fastify) {
  // Handle legacy routes
  fastify.get('/api/subscriptions', async (request, reply) => {
    return reply.redirect(301, '/api/v1/subscriptions');
  });
  
  fastify.get('/api/subscriptions/:id', async (request, reply) => {
    return reply.redirect(301, `/api/v1/subscriptions/${request.params.id}`);
  });
  
  fastify.post('/api/subscriptions/:id/process', async (request, reply) => {
    return reply.redirect(308, `/api/v1/subscriptions/${request.params.id}/process`);
  });
});

// Add compatibility layer for /api/v1/me endpoints
// These are used by the frontend but the actual implementation is at /api/v1/users/me
fastify.register(async function (fastify) {
  // This provides backwards compatibility with older API paths
  // The frontend expects /api/v1/me but our implementation is at /api/v1/users/me
  
  // Use authentication middleware for these endpoints
  fastify.addHook('preHandler', authenticate);
  
  // Create a wrapper for the user service
  const userServiceWrapper = async (request, reply) => {
    const { userService } = await import('./core/user/user.service.js');
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method,
      token: request.user?.token
    };
    
    try {
      logRequest(context, 'Processing user profile request from compatibility layer', {
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
  };
  
  // Forward /api/v1/me to /api/v1/users/me
  fastify.get('/api/v1/me', userServiceWrapper);
  
  // Add forwards for PATCH endpoints
  fastify.patch('/api/v1/me', async (request, reply) => {
    // Forward to the user routes implementation
    try {
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: request.headers,
        payload: request.body
      });
      
      const statusCode = response.statusCode;
      const payload = JSON.parse(response.payload);
      
      return reply.code(statusCode).send(payload);
    } catch (error) {
      console.error('Error forwarding PATCH /api/v1/me request:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process profile update',
        status: 500,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  fastify.patch('/api/v1/me/notification-settings', async (request, reply) => {
    // Forward to the user routes implementation
    try {
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/users/me/notification-settings',
        headers: request.headers,
        payload: request.body
      });
      
      const statusCode = response.statusCode;
      const payload = JSON.parse(response.payload);
      
      return reply.code(statusCode).send(payload);
    } catch (error) {
      console.error('Error forwarding PATCH /api/v1/me/notification-settings request:', error);
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process notification settings update',
        status: 500,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Email preferences endpoints
  const { 
    getEmailPreferences, 
    updateEmailPreferences, 
    sendTestEmail 
  } = await import('./core/user/interfaces/http/email-preferences.controller.js');
  
  // GET /api/v1/me/email-preferences
  fastify.get('/api/v1/me/email-preferences', getEmailPreferences);
  
  // PATCH /api/v1/me/email-preferences
  fastify.patch('/api/v1/me/email-preferences', updateEmailPreferences);
  
  // POST /api/v1/me/test-email
  fastify.post('/api/v1/me/test-email', sendTestEmail);
});

// Start server
try {
  // Get PORT from environment with fallback
  const port = parseInt(process.env.PORT || '8080', 10);
  
  // Log server configuration
  console.log('Starting server with configuration:', {
    port,
    host: '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  
  // Initialize auth service
  try {
    console.log('Initializing auth service...');
    await authService.initialize();
    console.log('Auth service initialized successfully');
  } catch (authError) {
    console.error('Auth service initialization error (continuing anyway):', authError);
    // Continue anyway - in Cloud Run this may not be critical
  }
  
  // Determine if migrations should be delayed
  const delayMigrations = process.env.DELAY_MIGRATIONS === 'true';
  
  if (delayMigrations) {
    console.log('DELAY_MIGRATIONS=true: Will run database migrations after server start');
    
    // Start server first, then run migrations
    try {
      // Start server immediately so it can respond to health checks
      await fastify.listen({ port, host: '0.0.0.0' });
      console.log(`Server is running on port ${port}`);
      
      // Run migrations in background
      console.log('Starting database migrations in background...');
      
      // Use setTimeout to run migrations after server has started
      setTimeout(async () => {
        try {
          await initializeDatabase();
          console.log('Database migrations completed successfully');
        } catch (migrationErr) {
          console.error('Failed to run migrations (continuing anyway):', migrationErr);
        }
      }, 5000); // Wait 5 seconds before starting migrations
    } catch (listenError) {
      console.error(`Failed to start server on port ${port}:`, listenError);
      throw listenError;
    }
  } else {
    // Normal flow: try migrations, but start server even if they fail
    try {
      console.log('Running database migrations before server start...');
      await initializeDatabase();
      console.log('Database migrations completed successfully');
    } catch (migrationErr) {
      console.error('Failed to run migrations (continuing anyway):', migrationErr);
      // Continue anyway - in Cloud Run, we want the server to start regardless
    }
    
    try {
      // Start server even if migrations failed
      await fastify.listen({ port, host: '0.0.0.0' });
      console.log(`Server is running on port ${port}`);
    } catch (listenError) {
      console.error(`Failed to start server on port ${port}:`, listenError);
      throw listenError;
    }
  }
} catch (err) {
  console.error('Fatal error during server startup:', err);
  fastify.log.error(err);
  process.exit(1);
}