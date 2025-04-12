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
import { getSecret, getFirebaseApiKey, getFirebaseConfig } from '../../../infrastructure/secrets/manager.js';

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
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' },
                avatar: { type: ['string', 'null'] },
                firebaseUid: { type: 'string' },
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

  // Firebase Authentication Proxy Endpoints

  // 1. Login with email and password
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        },
        required: ['email', 'password'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                email: { type: 'string', format: 'email' },
                displayName: { type: ['string', 'null'] },
                emailVerified: { type: 'boolean' }
              }
            },
            token: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      console.log(`🔑 [${new Date().toISOString()}] AUTH REQUEST: Login attempt for email: ${request.body.email}`);
      logRequest(context, 'Processing login request', { email: request.body.email });
      
      const auth = getFirebaseAuth();
      const { email, password } = request.body;
      
      // Use Firebase Admin SDK to sign in with email/password
      const userRecord = await auth.getUserByEmail(email)
        .catch(() => null);
      
      if (!userRecord) {
        console.log(`❌ [${new Date().toISOString()}] AUTH FAILURE: User not found for email: ${email}`);
        return reply.code(400).send({
          success: false,
          error: 'auth/user-not-found',
          message: 'No account exists with this email. Please check your email or register a new account.'
        });
      }
      
      // Get Firebase API key from Secret Manager
      console.log(`🔐 [${new Date().toISOString()}] Retrieving Firebase API key from Secret Manager...`);
      const apiKey = await getFirebaseApiKey();
      
      if (!apiKey) {
        console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: Firebase API key not available`);
        return reply.code(500).send({
          success: false,
          error: 'auth/configuration-error',
          message: 'Authentication is temporarily unavailable. Please try again later.'
        });
      }
      
      console.log(`✅ [${new Date().toISOString()}] Firebase API key retrieved successfully (length: ${apiKey.length})`);
      
      // Use Firebase Auth REST API to sign in with email/password
      console.log(`🔄 [${new Date().toISOString()}] Sending login request to Firebase Auth API...`);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Map Firebase error codes to user-friendly messages
        let errorMessage = 'Authentication failed. Please try again.';
        let errorCode = data.error?.message || 'auth/unknown-error';
        
        if (errorCode === 'EMAIL_NOT_FOUND') {
          errorCode = 'auth/user-not-found';
          errorMessage = 'No account exists with this email. Please check your email or register a new account.';
        } else if (errorCode === 'INVALID_PASSWORD') {
          errorCode = 'auth/wrong-password';
          errorMessage = 'Incorrect email or password. Please try again.';
        } else if (errorCode === 'USER_DISABLED') {
          errorCode = 'auth/user-disabled';
          errorMessage = 'This account has been disabled. Please contact support.';
        }
        
        console.log(`❌ [${new Date().toISOString()}] AUTH FAILURE: ${errorCode} for email: ${email}`);
        return reply.code(400).send({
          success: false,
          error: errorCode,
          message: errorMessage
        });
      }
      
      // Login successful
      console.log(`✅ [${new Date().toISOString()}] AUTH SUCCESS: Login successful for user: ${data.localId} (${email})`);
      return {
        success: true,
        user: {
          uid: data.localId,
          email: data.email,
          displayName: userRecord.displayName || null,
          emailVerified: data.emailVerified
        },
        token: data.idToken
      };
      
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: ${error.message}`, error);
      logError(context, error);
      
      return reply.code(500).send({
        success: false,
        error: 'auth/server-error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    }
  });

  // 2. Register a new user
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['email', 'password'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                email: { type: 'string', format: 'email' },
                displayName: { type: ['string', 'null'] },
                emailVerified: { type: 'boolean' }
              }
            },
            token: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      console.log(`🔑 [${new Date().toISOString()}] AUTH REQUEST: Registration attempt for email: ${request.body.email}`);
      logRequest(context, 'Processing registration request', { email: request.body.email });
      
      const { email, password, name } = request.body;
      
      // Get Firebase API key from Secret Manager
      console.log(`🔐 [${new Date().toISOString()}] Retrieving Firebase API key from Secret Manager...`);
      const apiKey = await getFirebaseApiKey();
      
      if (!apiKey) {
        console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: Firebase API key not available`);
        return reply.code(500).send({
          success: false,
          error: 'auth/configuration-error',
          message: 'Registration is temporarily unavailable. Please try again later.'
        });
      }
      
      console.log(`✅ [${new Date().toISOString()}] Firebase API key retrieved successfully (length: ${apiKey.length})`);
      
      // Use Firebase Auth REST API to create a new user
      console.log(`🔄 [${new Date().toISOString()}] Sending registration request to Firebase Auth API...`);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          displayName: name || email.split('@')[0],
          returnSecureToken: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Map Firebase error codes to user-friendly messages
        let errorMessage = 'Registration failed. Please try again.';
        let errorCode = data.error?.message || 'auth/unknown-error';
        
        if (errorCode === 'EMAIL_EXISTS') {
          errorCode = 'auth/email-already-in-use';
          errorMessage = 'This email is already registered. Please use a different email or try to login.';
        } else if (errorCode === 'WEAK_PASSWORD') {
          errorCode = 'auth/weak-password';
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (errorCode === 'INVALID_EMAIL') {
          errorCode = 'auth/invalid-email';
          errorMessage = 'Invalid email format. Please enter a valid email address.';
        }
        
        console.log(`❌ [${new Date().toISOString()}] AUTH FAILURE: ${errorCode} for email: ${email}`);
        return reply.code(400).send({
          success: false,
          error: errorCode,
          message: errorMessage
        });
      }
      
      // If display name is provided, update the user profile
      if (name) {
        console.log(`👤 [${new Date().toISOString()}] Updating user profile with display name: ${name}`);
        const auth = getFirebaseAuth();
        await auth.updateUser(data.localId, {
          displayName: name
        });
      }
      
      // Registration successful
      console.log(`✅ [${new Date().toISOString()}] AUTH SUCCESS: Registration successful for user: ${data.localId} (${email})`);
      return {
        success: true,
        user: {
          uid: data.localId,
          email: data.email,
          displayName: name || email.split('@')[0],
          emailVerified: false
        },
        token: data.idToken
      };
      
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: ${error.message}`, error);
      logError(context, error);
      
      return reply.code(500).send({
        success: false,
        error: 'auth/server-error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    }
  });

  // 3. Password reset
  fastify.post('/auth/reset-password', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const context = {
      requestId: request.id,
      path: request.url,
      method: request.method
    };

    try {
      console.log(`🔑 [${new Date().toISOString()}] AUTH REQUEST: Password reset request for email: ${request.body.email}`);
      logRequest(context, 'Processing password reset request', { email: request.body.email });
      
      const { email } = request.body;
      
      // Get Firebase API key from Secret Manager
      console.log(`🔐 [${new Date().toISOString()}] Retrieving Firebase API key from Secret Manager...`);
      const apiKey = await getFirebaseApiKey();
      
      if (!apiKey) {
        console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: Firebase API key not available`);
        // For security reasons, don't tell the user that the service is misconfigured
        return {
          success: true,
          message: 'If this email is registered, a password reset link has been sent.'
        };
      }
      
      console.log(`✅ [${new Date().toISOString()}] Firebase API key retrieved successfully (length: ${apiKey.length})`);
      
      // Use Firebase Auth REST API to send password reset email
      console.log(`🔄 [${new Date().toISOString()}] Sending password reset request to Firebase Auth API...`);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        let errorMessage = 'Password reset request failed. Please try again.';
        let errorCode = data.error?.message || 'auth/unknown-error';
        
        if (errorCode === 'EMAIL_NOT_FOUND') {
          // For security reasons, don't reveal if email exists
          console.log(`ℹ️ [${new Date().toISOString()}] Password reset requested for non-existent email: ${email}`);
          return {
            success: true,
            message: 'If this email is registered, a password reset link has been sent.'
          };
        }
        
        console.log(`❌ [${new Date().toISOString()}] AUTH FAILURE: ${errorCode} for email: ${email}`);
        return reply.code(400).send({
          success: false,
          error: errorCode,
          message: errorMessage
        });
      }
      
      // Password reset email sent successfully
      console.log(`✅ [${new Date().toISOString()}] AUTH SUCCESS: Password reset email sent for: ${email}`);
      return {
        success: true,
        message: 'Password reset email sent successfully.'
      };
      
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] AUTH ERROR: ${error.message}`, error);
      logError(context, error);
      
      // For security reasons, don't reveal if the operation failed
      return {
        success: true,
        message: 'If this email is registered, a password reset link has been sent.'
      };
    }
  });
} 