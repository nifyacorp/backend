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
import { logError } from './shared/logging/logger.js'; // Use central logger

// --- Server Initialization & Setup ---
const fastify = createServer();

async function main() {
  try {
    // Register core plugins (CORS, Swagger, Express)
    await registerPlugins(fastify);

    // Register custom content type parsers
    registerParsers(fastify);

    // --- Route Registration ---

    // Core routes (e.g., /health, /version)
    await fastify.register(coreRoutes);

    // Diagnostics routes (public for testing, uses Fastify and Express)
    // Consider securing these or making them environment-specific
    await fastify.register(diagnosticsRoutes, { prefix: '/api/v1/diagnostics' });
    fastify.use('/api/diagnostics', diagnosticsExpressRouter);
    console.log("Diagnostics routes registered.");

    // Register legacy route handlers (/api/auth, /api/subscriptions redirects)
    await fastify.register(legacyRoutes);

    // Register compatibility routes (/api/v1/me, /v1/me/*)
    // These are authenticated
    await fastify.register(compatibilityRoutes);
    console.log("Compatibility routes (e.g., /api/v1/me) registered.");

    // Public v1 routes
    await fastify.register(templateRoutes, { prefix: '/api/v1/templates' });
    console.log("Public v1 routes (templates) registered.");

    // Authenticated v1 routes
    await fastify.register(async function (fastifyInstance) {
      fastifyInstance.addHook('preHandler', authenticate);

      await fastifyInstance.register(userRoutes, { prefix: '/api/v1/users' });
      await fastifyInstance.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
      await fastifyInstance.register(notificationRoutes, { prefix: '/api/v1/notifications' });

      console.log("Authenticated v1 routes (users, subscriptions, notifications) registered.");
    });

    // --- Service Initialization ---
    // Initialize external services like Auth0 client
    try {
      console.log('Initializing auth service...');
      await authService.initialize();
      console.log('Auth service initialized successfully');
    } catch (authError) {
      // Log error but continue startup, as it might not be critical depending on the environment
      logError({ service: 'AuthServiceInit' }, authError, 'Auth service initialization failed (continuing startup)');
    }

    // --- Database Initialization & Server Start ---
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = '0.0.0.0';
    const delayMigrations = process.env.DELAY_MIGRATIONS === 'true';

    console.log('Server configuration:', { port, host, environment: process.env.NODE_ENV || 'development', delayMigrations });

    const startServer = async () => {
      try {
        await fastify.listen({ port, host });
        console.log(`Server listening on ${fastify.server.address().port}`);
      } catch (listenError) {
        logError({ phase: 'ServerListen' }, listenError, `Failed to start server on port ${port}`);
        throw listenError; // Re-throw to exit process
      }
    };

    const runMigrations = async () => {
      try {
        console.log('Initializing database connection and running migrations...');
        await initializeDatabase(); // Assumes this handles connection and migrations
        console.log('Database initialized successfully.');
      } catch (migrationErr) {
        logError({ phase: 'Migrations' }, migrationErr, 'Database initialization/migration failed (continuing startup)');
        // Decide if server should start despite migration failure. For Cloud Run, often yes.
      }
    };

    if (delayMigrations) {
      console.log('DELAY_MIGRATIONS enabled: Starting server first.');
      await startServer();
      // Run migrations asynchronously after a short delay
      console.log('Scheduling database initialization in the background (5 seconds delay).');
      setTimeout(runMigrations, 5000);
    } else {
      console.log('Running database initialization before starting server.');
      await runMigrations();
      await startServer();
    }

  } catch (err) {
    // Use Fastify logger for fatal startup errors if available, otherwise console
    const logger = fastify.log || console;
    logger.error({ phase: 'MainStartup', error: err.message, stack: err.stack }, 'Fatal error during server startup');
    process.exit(1);
  }
}

// --- Global Error Handling (Optional but Recommended) ---
// fastify.setErrorHandler(function (error, request, reply) {
//   logError({ requestId: request.id, path: request.url, method: request.method }, error, 'Unhandled error in route');
//   // Send generic error response
//   reply.status(500).send({ error: 'Internal Server Error' });
// });

// --- Start Application ---
main();