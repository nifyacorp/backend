import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ErrorCode } from '../../../core/shared/errors/AppError';

/**
 * Authentication interface representing user data
 */
export interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
}

/**
 * Extend FastifyRequest with Auth properties
 */
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
    isAuthenticated: boolean;
  }
  
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuth: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Authenticate request by validating auth headers
 */
async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Get authorization header
  const authHeader = request.headers.authorization;
  const userId = request.headers['x-user-id'] as string;
  
  // Initialize authenticated state
  request.isAuthenticated = false;
  
  // Check if headers exist
  if (!authHeader || !userId) {
    return;
  }
  
  // Parse Bearer token
  const [scheme, token] = authHeader.split(' ');
  
  // Validate token format
  if (scheme !== 'Bearer' || !token) {
    return;
  }
  
  try {
    // Verify token with Auth Service
    // TODO: Implement actual token verification with Auth Service
    
    // For now, we're assuming the token is valid if it exists
    // and just setting the user based on the user-id header
    request.user = {
      id: userId,
      email: `user-${userId}@example.com`, // Placeholder - should come from token verification
    };
    
    request.isAuthenticated = true;
  } catch (error) {
    // Do not throw here, just let isAuthenticated remain false
    request.log.error({ err: error }, 'Error authenticating user');
  }
}

/**
 * Middleware to require authentication
 */
function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.isAuthenticated || !request.user) {
      throw AppError.unauthorized('Authentication required');
    }
  };
}

/**
 * Plugin that adds authentication functionality
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Add authenticate method to fastify instance
  fastify.decorate('authenticate', authenticate);
  
  // Add requireAuth middleware generator
  fastify.decorate('requireAuth', requireAuth);
  
  // Add authentication hook that runs on every request
  fastify.addHook('onRequest', authenticate);
};

export default fp(authPlugin, {
  name: 'auth-middleware'
});