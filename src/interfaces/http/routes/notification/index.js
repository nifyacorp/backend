import { crudRoutes } from './crud.routes.js';
import { statusRoutes } from './status.routes.js';
import { statsRoutes } from './stats.routes.js';
import { realtimeRoutes } from './realtime.routes.js';

/**
 * Notification routes main entry point
 * This file registers all notification route modules
 */
export async function notificationRoutes(fastify, options) {
  // Register CRUD routes (get, create, update, delete)
  fastify.register(crudRoutes, { prefix: '' });
  
  // Register status-related routes (mark as read/unread)
  fastify.register(statusRoutes, { prefix: '' });
  
  // Register statistics routes
  fastify.register(statsRoutes, { prefix: '' });
  
  // Register realtime notification routes
  fastify.register(realtimeRoutes, { prefix: '' });
  
  // Root handler has been removed to avoid conflicts
  // The main prefix in index.js already handles the path mapping
}

export default notificationRoutes; 