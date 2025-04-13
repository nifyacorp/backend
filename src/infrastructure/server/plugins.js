import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

/**
 * Register core Fastify plugins
 * @param {FastifyInstance} fastify 
 */
export async function registerCorePlugins(fastify) {
  // CORS configuration
  await fastify.register(cors, {
    origin: true, // Reflect the request origin
    credentials: true, // Allow credentials (cookies)
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
  
  // File upload support
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
      files: 1 // Only allow one file at a time
    }
  });
} 