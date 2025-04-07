import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { SubscriptionRepositoryImpl } from '../../../infrastructure/database/repositories/SubscriptionRepositoryImpl';
import { SubscriptionServiceImpl } from '../../../core/application/subscription/services/SubscriptionServiceImpl';
import { SubscriptionService } from '../../../core/application/subscription/services/SubscriptionService';

/**
 * This plugin adds subscription service to the Fastify instance
 */
const subscriptionPlugin: FastifyPluginAsync = async (fastify) => {
  // Create repository instance
  const subscriptionRepository = new SubscriptionRepositoryImpl();
  
  // Create service instance
  const subscriptionService: SubscriptionService = new SubscriptionServiceImpl(subscriptionRepository);
  
  // Add to Fastify instance
  fastify.decorate('subscriptionService', subscriptionService);
};

export default fp(subscriptionPlugin, {
  name: 'subscription-service',
  dependencies: ['db-client']
});

// Add types to Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    subscriptionService: SubscriptionService;
  }
}