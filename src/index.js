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
import { firebaseSyncRoutes } from './interfaces/http/routes/firebase-sync.routes.js';
import diagnosticsRoutes from './interfaces/http/routes/diagnostics.routes.js';
import { firebaseAuthenticate } from './interfaces/http/middleware/firebase-auth.middleware.js';
import { initializeDatabase } from './infrastructure/database/client.js';
import { authService } from './core/auth/auth.service.js';
import * as loggerModule from './shared/logging/logger.js';
import { logger } from './shared/logging/logger.js';
import { initializeFirebaseAdmin } from './infrastructure/firebase/admin.js';
import { initialize as initializeSecretManager, validateAllFirebaseSecrets } from './infrastructure/secrets/manager.js';

// Initialize environment variables
dotenv.config();

// Use the server config from the createServer function
const fastify = createServer();
const { port, host } = fastify.serverConfig;

async function main() {
  try {
    console.log('🚀 Starting NIFYA Backend Service...');
    
    // Initialize Secret Manager first
    console.log('💼 Initializing Secret Manager...');
    await initializeSecretManager();
    console.log('💼 Secret Manager initialized.');
    
    // Validate all Firebase secrets are available
    console.log('🔑 Validating Firebase secrets...');
    const secretsValid = await validateAllFirebaseSecrets();
    if (!secretsValid) {
      console.error('⚠️ WARNING: Some Firebase secrets are missing. Authentication functionality may be limited.');
    } else {
      console.log('🔑 All Firebase secrets validated successfully!');
    }
    
    // Initialize Firebase Admin SDK
    console.log('🔥 Initializing Firebase Admin SDK...');
    await initializeFirebaseAdmin();
    console.log('🔥 Firebase Admin SDK initialized.');
    
    // Keep legacy auth initialization for backward compatibility during migration
    console.log('🔐 Initializing legacy authentication service...');
    await authService.initialize();
    console.log('🔐 Legacy authentication service initialized.');
    
    // Initialize database before starting server
    console.log('💾 Initializing database connection...');
    await initializeDatabase();
    console.log('💾 Database connection established.');

    console.log('🔌 Setting up server plugins and parsers...');
    // Register plugins and routes
    await registerPlugins(fastify);
    await registerParsers(fastify);
    console.log('🔌 Server plugins and parsers configured.');

    console.log('🛣️ Registering API routes...');
    // Register core routes (e.g., /health, /version) - No prefix
    await fastify.register(coreRoutes);

    // Register diagnostics routes under /diagnostics
    // Note: Removed the duplicate /health check from diagnostics.routes.js previously
    await fastify.register(diagnosticsRoutes, { prefix: '/diagnostics' });

    // Register legacy/compatibility routes - No prefix initially
    // These might define absolute paths or need specific root paths
    await fastify.register(legacyRoutes);
    await fastify.register(compatibilityRoutes);

    // Register Firebase sync routes and Firebase authentication proxy routes under /v1
    // NOTE: These must remain public (without auth middleware) since they're used for initial authentication
    await fastify.register(firebaseSyncRoutes, { prefix: '/api/v1' });
    console.log('🔓 Firebase authentication proxy endpoints registered at /api/v1/auth/*');

    // Register all authenticated API routes under /api/v1 using Firebase authentication
    await fastify.register(async (instance) => {
      // Use Firebase authentication middleware for all routes
      instance.addHook('preHandler', firebaseAuthenticate);
      
      // Register all authenticated routes
      await instance.register(userRoutes, { prefix: '/users' });
      await instance.register(subscriptionRoutes, { prefix: '/subscriptions' });
      await instance.register(notificationRoutes, { prefix: '/notifications' });
    }, { prefix: '/api/v1' });
    console.log('🛣️ All API routes registered.');

    // Start the server
    console.log('📡 Starting HTTP server...');
    await fastify.listen({ port, host });
    console.log(`🎉 Server successfully started and listening on port ${port}`);
    console.log(`🌐 Server address: http://${host}:${port}`);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
console.log('⚙️ Initializing application...');
main().catch((error) => {
  logger.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});