import { createServer, registerPlugins } from './infrastructure/server/setup.js';
import { registerParsers } from './infrastructure/server/parsers.js';
import { coreRoutes } from './interfaces/http/routes/core.routes.js';
import { legacyRoutes } from './interfaces/http/routes/legacy.routes.js';
import { compatibilityRoutes } from './interfaces/http/routes/compat.routes.js';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { subscriptionRoutes } from './interfaces/http/routes/subscription/index.js';
import { templateRoutes } from './interfaces/http/routes/template.routes.js';
import { notificationRoutes } from './interfaces/http/routes/notification.routes.js';
import diagnosticsRoutes, { expressRouter as diagnosticsExpressRouter } from './interfaces/http/routes/diagnostics.routes.js';
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import logger from '../../utils/logger.js';

async function main() {
  try {
    // Initialize database before starting server
    logger.info('Running database initialization before starting server.');
    await initializeDatabase();

    // Create and configure Fastify instance
    const fastify = createServer();
    const { port, host } = fastify.serverConfig;

    // Register plugins and routes
    await registerPlugins(fastify);
    await registerParsers(fastify);

    // Register core routes first
    await coreRoutes(fastify);
    await diagnosticsRoutes(fastify);

    // Register legacy routes for backward compatibility
    await legacyRoutes(fastify);
    await compatibilityRoutes(fastify);

    // Register public routes
    await templateRoutes(fastify);

    // Register authenticated routes
    await userRoutes(fastify);
    await subscriptionRoutes(fastify);
    await notificationRoutes(fastify);

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