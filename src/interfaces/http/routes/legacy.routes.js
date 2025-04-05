import express from '@fastify/express';

// This plugin handles the registration of legacy API routes (e.g., /api/auth, /api/subscriptions)
// which were previously defined directly in index.js or used Express middleware.

export async function legacyRoutes(fastify, options) {
  // Import auth routes dynamically (ensure path is correct)
  let authRoutes = null;
  try {
    // Corrected relative path from src/interfaces/http/routes/ to root/routes/
    const authModule = await import('../../../routes/auth.js');
    authRoutes = authModule.default;
  } catch (error) {
    console.error("Failed to import legacy auth routes:", error);
    // Create a dummy fallback object instead of using require('express')
    authRoutes = {
        // Provide a dummy .use method to prevent crash when fastify.use is called
        use: (path, handler) => {
            console.warn(`Legacy auth routes unavailable, dummy handler used for path: ${path}`);
            handler = (req, res) => res.status(503).send('Auth service unavailable');
        },
        // Add other methods if Express router structure is expected by fastify.use
        stack: [], // Mimic router property
        _router: true // Mimic router property
    };
  }

  // Register Express plugin IF NOT ALREADY REGISTERED GLOBALLY
  // Check if fastify.use exists, indicating @fastify/express is registered
  if (!fastify.use) {
    await fastify.register(express);
    console.warn('@fastify/express registered locally in legacyRoutes. Consider global registration.');
  }

  // Register Express-compatible auth routes if they were loaded or the dummy exists
  if (authRoutes) {
     fastify.use('/api/auth', authRoutes);
     // Log based on whether the real routes or the dummy was used
     if (authRoutes._router) { // Check if it's the dummy
        console.warn("Using dummy legacy /api/auth routes due to import failure.");
     } else {
        console.log("Legacy /api/auth routes registered.");
     }
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