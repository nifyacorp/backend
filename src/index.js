import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { subscriptionRoutes } from './interfaces/http/routes/subscription/index.js';
import { templateRoutes } from './interfaces/http/routes/template.routes.js';
import { notificationRoutes } from './interfaces/http/routes/notification.routes.js';
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import { ALLOWED_HEADERS } from './shared/constants/headers.js';
import diagnosticsRoutes from './interfaces/http/routes/diagnostics.routes.js';

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
    
    // Allow requests from Netlify subdomains and localhost for development
    if (
      origin.endsWith('.netlify.app') || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1')
    ) {
      return cb(null, true);
    }
    
    // Block other origins
    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ALLOWED_HEADERS
});

// Configure empty bodies for DELETE requests
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  if (req.method === 'DELETE' && (!body || body === '')) {
    done(null, {});
  } else {
    try {
      const json = JSON.parse(body || '{}');
      done(null, json);
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
});

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Nifya Orchestration Service API',
      description: 'API documentation for the Nifya Orchestration Service',
      version: process.env.npm_package_version || '1.0.0'
    },
    host: process.env.SERVICE_URL || 'localhost:3000',
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
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

await fastify.register(swaggerUI, {
  routePrefix: '/documentation'
});

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

// Start server
try {
  // Initialize services
  await initializeDatabase();
  await authService.initialize();
  
  const port = parseInt(process.env.PORT || '3000', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Server is running on ${fastify.server.address().port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}