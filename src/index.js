import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { subscriptionRoutes } from './interfaces/http/routes/subscription.routes.js';
import { templateRoutes } from './interfaces/http/routes/template.routes.js';
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors, {
  origin: true
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

// Add health check route
fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

await fastify.register(swaggerUI, {
  routePrefix: '/documentation'
});

// Register authentication middleware
fastify.register(async function (fastify) {
  fastify.addHook('preHandler', authenticate);
  
  // Protected routes
  fastify.register(userRoutes, { prefix: '/api/v1/users' });
  fastify.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
});

// Public routes
fastify.register(templateRoutes, { prefix: '/api/v1/templates' });

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