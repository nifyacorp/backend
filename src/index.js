import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { initializeDatabase } from './config/database.js';
import { initializeAuth } from './config/auth.js';
import { initializePubSub } from './config/pubsub.js';

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
      version: '1.0.0'
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

await fastify.register(swaggerUI, {
  routePrefix: '/documentation'
});

// Register auth plugin
await fastify.register(authPlugin);

// Register subscription routes
fastify.register(subscriptionRoutes, { prefix: '/subscriptions' });

// Start server
try {
  // Initialize database
  await initializeDatabase();

  // Initialize auth configuration
  await initializeAuth();
  
  // Initialize Pub/Sub subscription
  await initializePubSub();
  
  await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  console.log(`Server is running on ${fastify.server.address().port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}