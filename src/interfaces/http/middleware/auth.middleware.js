/**
 * Authentication Middleware
 * 
 * Consolidated implementation that provides both Fastify hooks (authenticate) 
 * and Express-style middleware (authMiddleware) for authentication.
 * 
 * This middleware handles:
 * - Token validation
 * - User identity verification
 * - User synchronization with database
 * - Public path exclusions
 */
import { authService } from '../../../core/auth/auth.service.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import logger from '../../../shared/logger.js';
import { AUTH_HEADER, USER_ID_HEADER, TOKEN_PREFIX } from '../../../shared/constants/headers.js';
import { query } from '../../../infrastructure/database/client.js';
import jwt from 'jsonwebtoken';

const PUBLIC_PATHS = [
  '/health',
  '/documentation',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/initOAuth',
  '/documentation/static'
];

/**
 * Synchronizes the user from auth token to database
 * Creates user record if it doesn't exist
 */
async function synchronizeUser(userId, userInfo, context) {
  try {
    // logger.logAuth(context, 'Checking if user exists in database', { userId }); // Simplified logging
    
    // Check if user exists in database
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    
    // If user exists, no need to synchronize
    if (userResult.rows.length > 0) {
      // logger.logAuth(context, 'User exists in database, no sync needed', { userId }); // Simplified logging
      return;
    }
    
    // User doesn't exist, create them using token info
    logger.logAuth(context, 'User not found in database, creating from token info', { 
      userId,
      email: userInfo.email,
    });
    
    const email = userInfo.email;
    const name = userInfo.name || email?.split('@')[0] || 'User';
    
    if (!email) {
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Token missing required email claim for user creation',
        401,
        { userId }
      );
    }
    
    // Create the user
    await query(
      `INSERT INTO users (
        id,
        email,
        display_name,
        metadata
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING`,
      [
        userId,
        email,
        name,
        JSON.stringify({
          emailNotifications: true,
          emailFrequency: 'immediate',
          instantNotifications: true,
          notificationEmail: email
        })
      ]
    );
    
    logger.logAuth(context, 'User synchronized to database successfully', { 
      userId,
      email
    });
  } catch (error) {
    logger.logError(context, 'Error synchronizing user', { 
      userId,
      error: error.message,
      stack: error.stack
    });
    
    // Don't throw error here, just log it
    // We don't want auth to fail if sync fails
  }
}

/**
 * Fastify hook for authentication
 */
export async function authenticate(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url
  };

  // Check if path is public
  if (PUBLIC_PATHS.some(path => request.url === path || request.url.startsWith(path))) {
    // logger.logAuth({ requestId: request.id, path: request.url }, 'Skipping auth for public path', { path: request.url, requestId: request.id }); // Simplified logging
    return;
  }

  try {
    // Check both case variations of headers for maximum compatibility
    const authHeaderLower = request.headers[AUTH_HEADER.toLowerCase()];
    const authHeaderExact = request.headers[AUTH_HEADER];
    const userIdLower = request.headers[USER_ID_HEADER.toLowerCase()];
    const userIdExact = request.headers[USER_ID_HEADER];
    
    // Use the header regardless of case
    const authHeader = authHeaderExact || authHeaderLower;
    const userId = userIdExact || userIdLower;
    
    console.log('🛡️ Authenticating request...', { 
      requestId: request.id, 
      path: request.url,
      authorizationHeader: request.headers.authorization ? `${request.headers.authorization.substring(0, 15)}...` : 'none',
      tokenExtracted: !!authHeader,
      xUserIdHeader: userId || 'none',
      timestamp: new Date().toISOString() 
    });

    // Check for missing header
    if (!authHeader) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Authorization header is required',
        401,
        { providedHeader: null }
      );
    }
    
    // Extract token, ensuring proper Bearer format
    // More permissive check - case insensitive
    if (!authHeader.match(/^bearer\s+.+$/i)) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        `Invalid ${AUTH_HEADER} header format. Must be: ${TOKEN_PREFIX}<token>`,
        401,
        { providedHeader: authHeader.substring(0, 15) + '...' }
      );
    }

    // Extract token more reliably (case insensitive and handles extra spaces)
    const token = authHeader.replace(/^bearer\s+/i, '');
    
    // Check if we have a user ID - if not, try to extract from token
    let userIdToUse = userId;
    if (!userIdToUse) {
      try {
        // Try to decode the token to extract the user ID
        const decoded = jwt.decode(token);
        if (decoded && decoded.sub) {
          console.log('Extracted user ID from token:', decoded.sub);
          userIdToUse = decoded.sub;
        }
      } catch (decodeError) {
        console.error('Error decoding token to extract user ID:', decodeError.message);
      }
    }
    
    if (!token) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Invalid token format',
        401,
        { missingToken: true }
      );
    }

    // Verify token
    try {
      const decoded = authService.verifyToken(token);
      
      // Set user info on request, using either provided or extracted user ID
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || decoded.email?.split('@')[0] || 'User',
        token: decoded
      };
      
      // Add token info to userContext for other services to use
      request.userContext = {
        token: {
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name
        }
      };

      // Synchronize user to database if necessary
      try {
        await synchronizeUser(decoded.sub, 
          { 
            email: decoded.email, 
            name: decoded.name || decoded.email?.split('@')[0] || 'User' 
          }, 
          { requestId: request.id, path: request.url }
        );
      } catch (syncError) {
        // Just log the error but don't fail authentication
        logger.logError({ requestId: request.id, path: request.url }, 
          `User sync error: ${syncError.message}`, { userId: decoded.sub });
      }
      
      console.log('✅ Authentication successful:', {
        userId: decoded.sub,
        requestId: request.id,
        path: request.url,
        timestamp: new Date().toISOString()
      });
    } catch (verifyError) {
      // If token verification fails, try to provide a helpful error
      console.error('❌ Token verification failed:', {
        error: verifyError.message,
        code: verifyError.code,
        requestId: request.id,
        path: request.url,
        timestamp: new Date().toISOString()
      });
      
      if (verifyError.code === 'TOKEN_EXPIRED') {
        throw new AppError(
          'TOKEN_EXPIRED',
          'Your session has expired. Please log in again.',
          401,
          { originalError: verifyError.message }
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
    console.error('💥 Error in authentication middleware:', { 
      requestId: request.id,
      path: request.url,
      errorName: error.name,
      errorMessage: error.message, 
      errorCode: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
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
 * Express-style middleware for authentication
 * This is included for compatibility with Express-style middleware
 */
export const authMiddleware = async (request, response, next) => {
  try {
    // Check for headers in both exact case and lowercase for maximum compatibility
    const authHeaderLower = request.headers[AUTH_HEADER.toLowerCase()];
    const authHeaderExact = request.headers[AUTH_HEADER];
    const userIdLower = request.headers[USER_ID_HEADER.toLowerCase()];
    const userIdExact = request.headers[USER_ID_HEADER];
    
    // Use whichever format is available
    const authHeader = authHeaderExact || authHeaderLower;
    const userId = userIdExact || userIdLower;
    
    // Log authentication details for debugging
    // console.log('Express auth middleware:', { // Simplified logging
    //   url: request.url,
    //   hasAuthHeader: !!authHeader,
    //   authHeaderPreview: authHeader ? `${authHeader.substring(0, 15)}...` : 'missing',
    //   hasUserId: !!userId
    // });
    
    // Skip authentication for public paths
    if (PUBLIC_PATHS.some(path => request.url.startsWith(path))) {
      return next();
    }
    
    // Check for missing authorization header
    if (!authHeader) {
      return response.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authorization header is required'
      });
    }
    
    // Check header format (case insensitive)
    if (!authHeader.match(/^bearer\s+.+$/i)) {
      return response.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Invalid Authorization header format. Must be: Bearer <token>'
      });
    }
    
    // Extract token (case insensitive and handles extra spaces)
    const token = authHeader.replace(/^bearer\s+/i, '');
    
    if (!token) {
      return response.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Invalid token format'
      });
    }
    
    let decodedToken;
    
    try {
      // The verifyToken function returns the decoded token payload directly
      decodedToken = await authService.verifyToken(token);
      
      // Verify user ID matches token subject
      if (userId && decodedToken.sub !== userId) {
        return response.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          message: 'User ID mismatch'
        });
      }
      
      // Set user info on request
      request.user = {
        id: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        token: decodedToken
      };
      
      // Synchronize user to database if necessary
      try {
        await synchronizeUser(decodedToken.sub, 
          { 
            email: decodedToken.email, 
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User' 
          }, 
          { requestId: request.headers['x-request-id'] || 'unknown', path: request.url }
        );
      } catch (syncError) {
        // Just log the error but don't fail authentication
        console.error('User sync error:', syncError.message);
      }
    } catch (verificationError) {
      console.error('Token verification failed:', verificationError.message);
      return response.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: verificationError.message || 'Invalid token'
      });
    }
    
    // Add token info to userContext for other services to use
    request.userContext = {
      token: {
        sub: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name
      }
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return response.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication error'
    });
  }
};

// Export both authentication methods
export default {
  authenticate,
  authMiddleware,
  synchronizeUser
};