/**
 * Firebase Authentication Synchronization Endpoint
 * 
 * This module implements the endpoint for synchronizing Firebase Authentication users
 * with the application's database.
 * 
 * Endpoint: /v1/users/sync
 * Method: POST
 * Authentication: Firebase ID token required
 */
import { verifyFirebaseIdToken, getFirebaseAuth } from '../../../infrastructure/firebase/admin.js';
import { syncFirebaseUser } from '../../../core/auth/auth.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(request, reply) {
  try {
    const idToken = request.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return reply.code(401).send({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }
    
    // Verify the token with Firebase
    const decodedToken = await verifyFirebaseIdToken(idToken);
    
    // Attach the decoded token to the request object
    request.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
      token: decodedToken
    };
    
    return;
  } catch (error) {
    console.error('Token verification failed:', error);
    return reply.code(401).send({ 
      success: false, 
      message: 'Invalid authentication token' 
    });
  }
}

/**
 * Register Firebase synchronization routes
 */
export async function firebaseSyncRoutes(fastify, options) {
  
  // User synchronization endpoint
  fastify.post('/users/sync', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            profile: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' },
                avatar: { type: ['string', 'null'] },
                emailVerified: { type: 'boolean' },
                lastLogin: { type: 'string', format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: verifyFirebaseToken
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      if (!request.user || !request.user.id) {
        throw new AppError(
          'UNAUTHORIZED',
          'Authentication required',
          401
        );
      }
      
      logRequest(context, 'Processing user sync request from Firebase', {
        firebaseUid: request.user.id
      });
      
      // Synchronize the Firebase user with our database
      const result = await syncFirebaseUser(request.user.id, context);
      
      return {
        success: true,
        profile: result.profile
      };
      
    } catch (error) {
      logError(context, error);
      
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  });
} 