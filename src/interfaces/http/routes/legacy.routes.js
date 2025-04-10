import express from '@fastify/express';

/**
 * Legacy routes that redirect old API paths to new versioned endpoints
 * This is a temporary solution until all clients are updated
 */
export async function legacyRoutes(fastify, options) {
  console.log("Registering legacy route redirects...");
  
  // Handle legacy auth route redirects
  fastify.get('/api/auth/me', async (request, reply) => {
    return reply.redirect(301, '/api/v1/users/me');
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    return reply.redirect(308, '/api/auth/v1/login');
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    return reply.redirect(308, '/api/auth/v1/logout');
  });

  // Handle legacy subscription route redirects
  fastify.get('/api/subscriptions', async (request, reply) => {
    return reply.redirect(301, '/api/v1/subscriptions');
  });

  fastify.get('/api/subscriptions/:id', async (request, reply) => {
    // Ensure proper encoding of parameters in redirect URLs if they contain special characters
    const safeId = encodeURIComponent(request.params.id);
    return reply.redirect(301, `/api/v1/subscriptions/${safeId}`);
  });

  fastify.post('/api/subscriptions/:id/process', async (request, reply) => {
    // Use 308 Permanent Redirect to preserve the POST method
    const safeId = encodeURIComponent(request.params.id);
    return reply.redirect(308, `/api/v1/subscriptions/${safeId}/process`);
  });

  console.log("Legacy redirects registered successfully.");
} 