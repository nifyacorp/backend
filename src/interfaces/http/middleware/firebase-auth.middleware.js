/**
 * Firebase Authentication Middleware
 * 
 * Provides both Fastify hooks (firebaseAuthenticate) 
 * and Express-style middleware (firebaseAuthMiddleware) for Firebase authentication.
 * 
 * This middleware handles:
 * - Firebase token validation
 * - User identity verification
 * - User synchronization with database
 * - Public path exclusions
 */
import { getFirebaseAuth } from '../../../infrastructure/firebase/admin.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import logger from '../../../shared/logger.js';
import { query } from '../../../infrastructure/database/client.js';

// Define public paths that don't require authentication
const PUBLIC_PATHS = [
  '/health',
  '/auth/public',
  '/documentation',
  '/documentation/json',
  '/documentation/static',
  '/docs',
  '/api-docs'
];

/**
 * Synchronizes the user from Firebase token to database
 * Creates user record if it doesn't exist
 */
async function synchronizeUser(uid, userInfo, context) {
  try {
    // Check if user exists in database - using Firebase UID as the primary key
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [uid]
    );
    
    // If user exists with Firebase UID as the primary key, no need to synchronize
    if (userResult.rows.length > 0) {
      return;
    }
    
    // User doesn't exist, create new user
    logger.logAuth(context, 'User not found in database, creating from Firebase', { 
      firebaseUid: uid,
      email: userInfo.email,
    });
    
    const email = userInfo.email;
    const name = userInfo.name || email?.split('@')[0] || 'User';
    
    if (!email) {
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Token missing required email claim for user creation',
        401,
        { firebaseUid: uid }
      );
    }
    
    // Create the user with Firebase UID as the primary key
    await query(
      `INSERT INTO users (
        id,
        email,
        display_name,
        metadata
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET 
        email = $2,
        display_name = $3,
        updated_at = NOW()`,
      [
        uid, // Using Firebase UID directly as the primary key
        email,
        name,
        JSON.stringify({
          profile: {
            bio: "",
            interests: []
          },
          preferences: {
            language: "es",
            theme: "light"
          },
          notifications: {
            email: {
              enabled: true,
              useCustomEmail: false,
              customEmail: null,
              digestTime: "08:00"
            }
          },
          security: {
            lastPasswordChange: null,
            lastLogoutAllDevices: null
          },
          // Keep these fields for backward compatibility
          emailVerified: userInfo.email_verified || false,
          emailNotifications: true,
          emailFrequency: "daily",
          instantNotifications: true,
          notificationEmail: email
        })
      ]
    );
    
    logger.logAuth(context, 'User synchronized to database successfully', { 
      firebaseUid: uid,
      email
    });
  } catch (error) {
    logger.logError(context, 'Error synchronizing user', { 
      firebaseUid: uid,
      error: error.message,
      stack: error.stack
    });
    
    // Don't throw error here, just log it
    // We don't want auth to fail if sync fails
  }
}

/**
 * Firebase Authentication Middleware for Fastify
 */
export async function firebaseAuthenticate(request, reply) {
  try {
    // Skip authentication for public paths
    if (PUBLIC_PATHS.some(path => request.url.startsWith(path))) {
      return;
    }
    
    // Extract authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.match(/^bearer\s+.+$/i)) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Authorization header is required and must be in format: Bearer <token>',
        401
      );
    }
    
    // Extract token
    const token = authHeader.replace(/^bearer\s+/i, '');
    
    if (!token) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Invalid token format',
        401,
        { missingToken: true }
      );
    }
    
    try {
      // Verify Firebase token
      const auth = getFirebaseAuth();
      const decodedToken = await auth.verifyIdToken(token);
      
      // Set user info on request
      request.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        token: decodedToken
      };
      
      // Add token info to userContext for other services
      request.userContext = {
        token: {
          sub: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name
        }
      };
      
      // Synchronize user with database
      try {
        await synchronizeUser(
          decodedToken.uid, 
          { 
            email: decodedToken.email, 
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
            email_verified: decodedToken.email_verified
          }, 
          { requestId: request.id, path: request.url }
        );
      } catch (syncError) {
        // Log error but don't fail authentication
        logger.logError({ requestId: request.id, path: request.url }, 
          `User sync error: ${syncError.message}`, { userId: decodedToken.uid });
      }
      
      logger.logAuth({ 
        requestId: request.id, 
        path: request.url 
      }, 'Firebase authentication successful', { userId: decodedToken.uid });
    } catch (verifyError) {
      logger.logError({ 
        requestId: request.id, 
        path: request.url 
      }, 'Firebase token verification failed', { error: verifyError.message, code: verifyError.code });
      
      // Map Firebase error codes to our error types
      if (verifyError.code === 'auth/id-token-expired') {
        throw new AppError(
          'TOKEN_EXPIRED',
          'Your session has expired. Please log in again.',
          401
        );
      }
      
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Invalid authentication token. Please log in again.',
        401,
        { originalError: verifyError.message }
      );
    }
  } catch (error) {
    logger.logError({
      requestId: request.id,
      path: request.url
    }, 'Authentication error', { 
      errorName: error.name,
      errorMessage: error.message, 
      errorCode: error.code
    });
    
    // Return error response
    const errorResponse = {
      status: 'error',
      code: error.code || 'UNAUTHORIZED',
      message: error.message || 'Authentication required'
    };
    
    reply.code(401).send(errorResponse);
  }
}

/**
 * Express-style middleware for Firebase authentication
 */
export const firebaseAuthMiddleware = async (request, response, next) => {
  try {
    // Skip authentication for public paths
    if (PUBLIC_PATHS.some(path => request.url.startsWith(path))) {
      return next();
    }
    
    const requestId = request.id || `req-${Date.now()}`;
    const context = { requestId, path: request.url, method: request.method };
    
    logger.logAuth(context, 'Processing authentication request');

    // Check for Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'MISSING_TOKEN',
        'Authentication required. Please provide a valid Firebase token.',
        401
      );
    }
    
    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify Firebase token
    logger.logAuth(context, 'Verifying Firebase token');
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(token);
    
    const { uid, email, name, email_verified } = decodedToken;
    
    // Check if user exists in database by Firebase UID (using it as the primary key)
    logger.logAuth(context, 'Looking up user in database', { firebaseUid: uid });
    const userResult = await query(
      'SELECT id, email, display_name, role FROM users WHERE id = $1',
      [uid]
    );
    
    let userId;
    
    if (userResult.rowCount === 0) {
      // User doesn't exist in our database, create them
      logger.logAuth(context, 'User not found in database, creating new user record', { 
        firebaseUid: uid, 
        email 
      });
      
      // Extract display name from Firebase or use email as fallback
      const displayName = decodedToken.name || 
                         decodedToken.display_name || 
                         email.split('@')[0];
      
      // Create user in database
      const newUserResult = await query(
        `INSERT INTO users (
          id,
          email, 
          display_name, 
          role,
          metadata
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          uid, // Using Firebase UID directly as the primary key
          email, 
          displayName, 
          'user',
          JSON.stringify({ 
            profile: {
              bio: "",
              interests: []
            },
            preferences: {
              language: "es",
              theme: "light"
            },
            notifications: {
              email: {
                enabled: true,
                useCustomEmail: false,
                customEmail: null,
                digestTime: "08:00"
              }
            },
            security: {
              lastPasswordChange: null,
              lastLogoutAllDevices: null
            },
            // Keep these fields for backward compatibility
            source: 'firebase',
            emailVerified: email_verified || false,
            emailNotifications: true,
            emailFrequency: "daily",
            instantNotifications: true,
            notificationEmail: email
          })
        ]
      );
      
      userId = newUserResult.rows[0].id;
      logger.logAuth(context, 'New user created in database', { userId, firebaseUid: uid });
    } else {
      // User exists, use their database ID
      userId = userResult.rows[0].id;
      logger.logAuth(context, 'User found in database', { userId, firebaseUid: uid });
      
      // Update user information if needed (optional)
      // This keeps Firebase as source of truth for basic profile info
      if (name && name !== userResult.rows[0].display_name) {
        await query(
          'UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2',
          [name, userId]
        );
        logger.logAuth(context, 'Updated user display name', { userId });
      }
    }
    
    // Attach user info to request
    request.user = {
      id: userId,
      email: email,
      display_name: name || userResult.rows[0]?.display_name,
      role: userResult.rows[0]?.role || 'user'
    };
    
    logger.logAuth(context, 'Authentication successful', { userId });
    next();
  } catch (error) {
    logger.logError({ path: request.url, method: request.method }, 'Authentication error', { 
      error: error.message,
      code: error.code
    });
    
    // Map Firebase error codes to user-friendly messages
    if (error.code === 'auth/id-token-expired') {
      return response.status(401).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.'
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return response.status(401).json({
        status: 'error',
        code: 'TOKEN_REVOKED',
        message: 'Your authentication token has been revoked. Please log in again.'
      });
    }
    
    return response.status(401).json({
      status: 'error',
      code: error.code || 'AUTHENTICATION_ERROR',
      message: error.message || 'Authentication failed. Please log in again.'
    });
  }
}; 