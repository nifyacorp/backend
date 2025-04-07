import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { NotificationRepositoryImpl } from '../../../infrastructure/database/repositories/NotificationRepositoryImpl';
import { NotificationServiceImpl } from '../../../core/application/notification/services/NotificationServiceImpl';
import { NotificationService } from '../../../core/application/notification/services/NotificationService';

/**
 * This plugin adds notification service to the Fastify instance
 */
const notificationPlugin: FastifyPluginAsync = async (fastify) => {
  // Create repository instance
  const notificationRepository = new NotificationRepositoryImpl();
  
  // Create service instance
  const notificationService: NotificationService = new NotificationServiceImpl(notificationRepository);
  
  // Add to Fastify instance
  fastify.decorate('notificationService', notificationService);
};

export default fp(notificationPlugin, {
  name: 'notification-service',
  dependencies: ['db-client']
});

// Add types to Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    notificationService: NotificationService;
  }
}