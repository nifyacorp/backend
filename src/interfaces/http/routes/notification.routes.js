import { notificationRoutes as notificationModularRoutes } from './notification/index.js';

/**
 * Notification routes for Fastify
 * This file exists for backward compatibility and delegates to the modular routes
 */
export async function notificationRoutes(fastify, options) {
  // Directly call the modular routes function instead of registering again
  // This prevents duplicate route registration
  await notificationModularRoutes(fastify, options);
}

export default notificationRoutes;