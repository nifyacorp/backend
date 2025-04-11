/**
 * Root schemas index
 * Main entry point for all schemas in the application
 */

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
  // Simple conversion - in production you'd want to use a library like zod-to-json-schema
  // or implement a more complete conversion
  return schema.constructor.name === 'ZodObject' 
    ? {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(schema.shape).map(([key, value]) => {
            // Handle different Zod types for basic conversion
            let prop;
            if (value.constructor.name === 'ZodString') {
              prop = { type: 'string' };
              if (value._def.checks) {
                for (const check of value._def.checks) {
                  if (check.kind === 'email') prop.format = 'email';
                  if (check.kind === 'uuid') prop.format = 'uuid';
                  if (check.kind === 'url') prop.format = 'uri';
                  if (check.kind === 'min') prop.minLength = check.value;
                  if (check.kind === 'max') prop.maxLength = check.value;
                }
              }
            } else if (value.constructor.name === 'ZodNumber') {
              prop = { type: 'number' };
              if (value._def.checks) {
                for (const check of value._def.checks) {
                  if (check.kind === 'int') prop.type = 'integer';
                  if (check.kind === 'min') prop.minimum = check.value;
                  if (check.kind === 'max') prop.maximum = check.value;
                }
              }
            } else if (value.constructor.name === 'ZodBoolean') {
              prop = { type: 'boolean' };
            } else if (value.constructor.name === 'ZodEnum') {
              prop = { 
                type: 'string', 
                enum: value._def.values 
              };
            } else if (value.constructor.name === 'ZodArray') {
              prop = { 
                type: 'array',
                items: { type: 'string' }  // Simplified - would need recursion for nested schemas
              };
            } else if (value.constructor.name === 'ZodObject') {
              // Recursive call for nested objects
              prop = zodToJsonSchema(value);
            } else {
              // Default fallback
              prop = { type: 'string' };
            }
            
            // Handle optional and nullable
            if (value.isOptional?.()) {
              // For optional fields
            } else if (schema.required?.[key]) {
              // Mark as required if not optional
            }
            
            return [key, prop];
          })
        )
      }
    : { type: 'object' }; // Default fallback
} 