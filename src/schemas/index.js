/**
 * Root schemas index
 * Main entry point for all schemas in the application
 */

// Import the professional library for Zod to JSON Schema conversion
import zodToJsonSchemaLib from 'zod-to-json-schema';

// Common schemas used across the application
export * as common from './common/index.js';

// User-related schemas
export * as user from './user/index.js';

// Notification-related schemas
export * as notification from './notification/index.js';

// Subscription-related schemas
// Note: These are already organized in a modular way
export * as subscription from './subscription/index.js';

/**
 * Common schema utility to convert Zod schemas to Fastify JSON Schema format
 * This allows using Zod schemas with Fastify's schema validation
 * 
 * @param {import('zod').ZodType} schema - The Zod schema to convert
 * @returns {Object} JSON Schema compatible with Fastify
 */
export function zodToJsonSchema(schema) {
  // Use the professional library with configuration for Fastify compatibility
  return zodToJsonSchemaLib(schema, {
    $refStrategy: 'none', // Don't use $ref in the output
    strictMode: false,    // Don't be strict about additional properties
    errorMessages: true,  // Include error messages
  });
} 