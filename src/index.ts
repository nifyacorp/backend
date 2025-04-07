import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { initializeClient } from './infrastructure/database/client';
import dbClientPlugin from './interfaces/fastify/plugins/db-client';
import authPlugin from './interfaces/fastify/plugins/auth';
import errorHandlerPlugin from './interfaces/fastify/plugins/error-handler';
import subscriptionPlugin from './interfaces/fastify/plugins/subscription';
import subscriptionRoutes from './interfaces/rest/subscription/routes';

/**
 * Create and configure the Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });
  
  // Initialize database client
  initializeClient();
  
  // Register plugins
  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  });
  
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      }
    }
  });
  
  await fastify.register(fastifySwagger, {
    routePrefix: '/documentation',
    swagger: {
      info: {
        title: 'NIFYA API',
        description: 'NIFYA Backend API',
        version: '1.0.0'
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here'
      },
      host: process.env.API_HOST || 'localhost',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        }
      }
    },
    exposeRoute: true
  });
  
  // Register custom plugins
  await fastify.register(errorHandlerPlugin);
  await fastify.register(dbClientPlugin);
  await fastify.register(authPlugin);
  await fastify.register(subscriptionPlugin);
  
  // Register routes
  await fastify.register(subscriptionRoutes, { prefix: '/api/v1' });
  
  // Add health check route
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
  
  // Add root route
  fastify.get('/', async (request, reply) => {
    reply.redirect('/documentation');
  });
  
  return fastify;
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  try {
    const server = await createServer();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  start();
}

// Export for testing purposes
export { start };