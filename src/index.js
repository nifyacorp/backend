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
import { firebaseSyncRoutes } from './interfaces/http/routes/firebase-sync.routes.js';
import diagnosticsRoutes from './interfaces/http/routes/diagnostics.routes.js';
import { firebaseAuthenticate } from './interfaces/http/middleware/firebase-auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import * as loggerModule from './shared/logging/logger.js';
import { logger } from './shared/logging/logger.js';
import { initializeFirebaseAdmin } from './infrastructure/firebase/admin.js';

// Initialize environment variables
dotenv.config();

// Use the server config from the createServer function
const fastify = createServer();
const { port, host } = fastify.serverConfig;

async function main() {
  try {
    // Initialize Firebase Admin SDK
    logger.info('Initializing Firebase Admin SDK...');
    await initializeFirebaseAdmin();
    
    // Keep legacy auth initialization for backward compatibility during migration
    logger.info('Initializing legacy authentication service...');
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

    // Register Firebase sync routes under /v1 (without using the global Firebase authentication middleware)
    await fastify.register(firebaseSyncRoutes, { prefix: '/v1' });

    // Register all authenticated API routes under /api/v1 using Firebase authentication
    await fastify.register(async (instance) => {
      // Use Firebase authentication middleware for all routes
      instance.addHook('preHandler', firebaseAuthenticate);
      
      // Register all authenticated routes
      await instance.register(userRoutes, { prefix: '/users' });
      await instance.register(subscriptionRoutes, { prefix: '/subscriptions' });
      await instance.register(notificationRoutes, { prefix: '/notifications' });
      await instance.register(registerSubscriptionProcessingRoutes, { prefix: '/subscription-processing' });
    }, { prefix: '/api/v1' });

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