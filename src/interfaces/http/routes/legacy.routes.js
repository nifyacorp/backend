import express from '@fastify/express';

// This plugin handles the registration of legacy API routes (e.g., /api/auth, /api/subscriptions)
// which were previously defined directly in index.js or used Express middleware.

export async function legacyRoutes(fastify, options) {
  // Import auth routes dynamically (ensure path is correct)
  let authRoutes = null;
  try {
    const authModule = await import('../../routes/auth.js'); // Adjust path if necessary
    authRoutes = authModule.default;
  } catch (error) {
    console.error("Failed to import legacy auth routes:", error);
    // Create a dummy router if import fails to prevent crash
    const express = require('express');
    authRoutes = express.Router();
    authRoutes.use((req, res) => res.status(503).send('Auth service unavailable'));
  }

  // Register Express plugin IF NOT ALREADY REGISTERED GLOBALLY
  // Check if fastify.use exists, indicating @fastify/express is registered
  if (!fastify.use) {
    await fastify.register(express);
    console.warn('@fastify/express registered locally in legacyRoutes. Consider global registration.');
  }

  // Register Express-compatible auth routes if they were loaded
  if (authRoutes) {
     fastify.use('/api/auth', authRoutes);
     console.log("Legacy /api/auth routes registered.");
  }

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

  console.log("Legacy subscription redirects registered.");

} 