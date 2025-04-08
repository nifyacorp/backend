import * as dotenv from 'dotenv';
import * as process from 'process';
import { createServer, registerPlugins } from './infrastructure/server/setup.js';
import { registerParsers } from './infrastructure/server/parsers.js';
import { coreRoutes } from './interfaces/http/routes/core.routes.js';
import { legacyRoutes } from './interfaces/http/routes/legacy.routes.js';
import { compatibilityRoutes } from './interfaces/http/routes/compat.routes.js';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { subscriptionRoutes } from './interfaces/http/routes/subscription/index.js';
import { notificationRoutes } from './interfaces/http/routes/notification.routes.js';
import { registerSubscriptionProcessingRoutes } from './interfaces/http/routes/subscription-processing.routes.js';
import diagnosticsRoutes from './interfaces/http/routes/diagnostics.routes.js';
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import * as loggerModule from './shared/logging/logger.js';

// Initialize environment variables
dotenv.config();

// Use the server config from the createServer function
const fastify = createServer();
const { port, host } = fastify.serverConfig;

// Create a logger object to match the import pattern used elsewhere
const logger = {
  info: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args)
};

async function main() {
  try {
    // Initialize auth service to load JWT secrets
    logger.info('Initializing authentication service...');
    await authService.initialize();
    
    // Initialize database before starting server
    logger.info('Running database initialization before starting server.');
    await initializeDatabase();

    // Register plugins and routes
    await registerPlugins(fastify);
    await registerParsers(fastify);

    // Register core routes (e.g., /health, /version) - No prefix
    await fastify.register(coreRoutes);

    // Register diagnostics routes under /diagnostics
    // Note: Removed the duplicate /health check from diagnostics.routes.js previously
    await fastify.register(diagnosticsRoutes, { prefix: '/diagnostics' });

    // Register legacy/compatibility routes - No prefix initially
    // These might define absolute paths or need specific root paths
    await fastify.register(legacyRoutes);
    await fastify.register(compatibilityRoutes);

    // Register authenticated API routes under /api/v1
    await fastify.register(userRoutes, { prefix: '/api/v1/users' });
    await fastify.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
    await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    
    // Register alternative subscription-processing routes (with authentication)
    await fastify.register(async (instance) => {
      instance.addHook('preHandler', authenticate);
      await instance.register(registerSubscriptionProcessingRoutes);
    }, { prefix: '/api/v1/subscription-processing' });

    // Start the server
    await fastify.listen({ port, host });
    logger.info(`Server listening on ${port}`);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});