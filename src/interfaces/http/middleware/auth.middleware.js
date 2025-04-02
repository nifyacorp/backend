import { authService } from '../../../core/auth/auth.service.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import logger from '../../../shared/logger.js';
import { AUTH_HEADER, USER_ID_HEADER, TOKEN_PREFIX } from '../../../shared/constants/headers.js';

const PUBLIC_PATHS = [
  '/health',
  '/documentation',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/initOAuth',
  '/documentation/static'
];

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
    logger.logAuth({ requestId: request.id, path: request.url }, 'Skipping auth for public path', { 
      path: request.url,
      requestId: request.id
    });
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
    
    logger.logAuth({ requestId: request.id, path: request.url }, 'Processing authentication', {
      hasAuthLower: !!authHeaderLower,
      hasAuthExact: !!authHeaderExact,
      hasUserIdLower: !!userIdLower,
      hasUserIdExact: !!userIdExact,
      authHeader: authHeader ? `${authHeader.substring(0, 15)}...` : 'missing',
      path: request.url,
      requestId: request.id
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
    
    if (!token || !userId) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        AUTH_ERRORS.MISSING_HEADERS.message,
        401,
        { missingToken: !token, missingUserId: !userId }
      );
    }

    // Log token details for debugging (excluding sensitive parts)
    logger.logAuth({ requestId: request.id, path: request.url }, 'Token verification attempt', {
      tokenLength: token?.length,
      hasUserId: !!userId,
      requestId: request.id
    });

    const decoded = authService.verifyToken(token);
    
    if (decoded.sub !== userId) {
      throw new AppError(
        AUTH_ERRORS.USER_MISMATCH.code,
        AUTH_ERRORS.USER_MISMATCH.message,
        401,
        { tokenUserId: decoded.sub, headerUserId: userId }
      );
    }

    // Set user info on request
    request.user = {
      id: userId,
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

    logger.logAuth({ requestId: request.id, path: request.url }, 'Authentication successful', { 
      userId,
      requestId: request.id
    });
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      code: error.code
    });
    
    reply.code(error.status || 401).send(error.toJSON ? error.toJSON() : {
      error: error.message,
      code: error.code || 'AUTH_ERROR',
      status: error.status || 401
    });
    
    return reply;
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
    console.log('Express auth middleware:', {
      url: request.url,
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? `${authHeader.substring(0, 15)}...` : 'missing',
      hasUserId: !!userId
    });
    
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
    
    try {
      // The verifyToken function returns the decoded token payload directly
      const decodedToken = await authService.verifyToken(token);
      
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
        sub: verificationResult.payload.sub,
        email: verificationResult.payload.email,
        name: verificationResult.payload.name
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
  authMiddleware
};