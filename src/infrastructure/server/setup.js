import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import express from '@fastify/express';
import { ALLOWED_HEADERS } from '../../shared/constants/headers.js';
import apiDocs from '../../shared/utils/api-docs.js'; // Assuming path is correct
import { logger } from '../../shared/logging/logger.js';
import { registerCorePlugins } from './plugins.js';

/**
 * Creates and configures the Fastify server instance.
 * @returns {import('fastify').FastifyInstance}
 */
export function createServer() {
  const fastify = Fastify({
    logger: true, // Consider replacing with custom logger like Pino
    bodyLimit: 1048576, // 1MiB
    exposeHeadRoutes: true,
    ignoreTrailingSlash: true,
    onProtoPoisoning: 'error', // More secure default
    onConstructorPoisoning: 'error', // More secure default
    trustProxy: true,
    // Add custom ajv options to be more permissive with validation
    ajv: {
      customOptions: {
        strict: false,           // Turn off strict mode
        strictSchema: false,     // Don't be strict about schema
        strictTypes: false,      // Don't be strict about types
        strictRequired: false,   // Don't be strict about required
        allErrors: true,         // Show all errors, not just the first
        removeAdditional: false, // Don't remove additional properties
        useDefaults: true,       // Use defaults for missing properties
        coerceTypes: true,       // Try to coerce types when possible
        // Allow custom keywords (don't fail on unknown keywords)
        keywords: ['spa']
      }
    }
    // Add request ID generation if not using a custom logger that provides it
    // requestIdHeader: 'x-request-id',
    // genReqId: function (req) { return require('crypto').randomUUID() }
  });

  // Get port from environment variable with fallback
  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';

  // Store server configuration for logging
  fastify.decorate('serverConfig', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
    delayMigrations: false
  });

  logger.info("Fastify instance created with configuration:", {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development'
  });

  return fastify;
}

/**
 * Registers essential Fastify plugins (CORS, Swagger, Express).
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function registerPlugins(fastify) {
  // Register core plugins (CORS and multipart)
  await registerCorePlugins(fastify);
  console.log("Core plugins registered (CORS, multipart).");

  // Swagger Documentation
  await fastify.register(swagger, {
    openapi: apiDocs.enhancedOpenAPIConfig // Assuming this object exists and is configured
  });
  console.log("Swagger plugin registered.");

  // Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      // ... other UI config options ...
    },
    staticCSP: true // Enable Content Security Policy
  });
  console.log("Swagger UI plugin registered.");

  // Express Compatibility (if needed for middleware like legacy auth)
  await fastify.register(express);
  console.log("@fastify/express plugin registered.");

  // Setup additional documentation pages (e.g., markdown files)
  if (apiDocs.setupAdditionalDocs) {
      apiDocs.setupAdditionalDocs(fastify);
      console.log("Additional API documentation pages setup.");
  } else {
      console.warn("apiDocs.setupAdditionalDocs function not found.");
  }
} 