import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { getClient, setRLSContext, clearRLSContext } from '../../../infrastructure/database/client';

/**
 * This plugin adds database client to the Fastify instance
 */
const dbClientPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize the database client
  const client = getClient();
  
  // Decorate Fastify instance with client
  fastify.decorate('db', client);
  
  // Add helper functions
  fastify.decorate('setRLSContext', setRLSContext);
  fastify.decorate('clearRLSContext', clearRLSContext);
  
  // Add hook to set RLS context for each request
  fastify.addHook('onRequest', async (request) => {
    const userId = request.headers['x-user-id'] as string;
    
    if (userId) {
      await setRLSContext(userId);
    }
  });
  
  // Add hook to clear RLS context after each request
  fastify.addHook('onResponse', async () => {
    await clearRLSContext();
  });
  
  // Add hook to clear RLS context on server errors
  fastify.addHook('onError', async () => {
    await clearRLSContext();
  });
};

export default fp(dbClientPlugin, {
  name: 'db-client'
});

// Add types to Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    db: SupabaseClient;
    setRLSContext: typeof setRLSContext;
    clearRLSContext: typeof clearRLSContext;
  }
}