/**
 * Subscription Routes Index
 * This file combines all subscription-related routes
 */

import { registerTypeRoutes } from './types.routes.js';
import { registerCrudRoutes } from './crud.routes.js';
import { registerProcessRoutes } from './process.routes.js';
import { registerSharingRoutes } from './sharing.routes.js';

/**
 * Register all subscription routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options
 */
export async function subscriptionRoutes(fastify, options) {
  // Register all route groups
  await registerTypeRoutes(fastify, options);
  await registerCrudRoutes(fastify, options);
  await registerProcessRoutes(fastify, options);
  await registerSharingRoutes(fastify, options);
  
  // API metadata is now defined in crud.routes.js to avoid conflicts
}

export default subscriptionRoutes; 