import { authService } from '../../../core/auth/auth.service.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logAuth, logError } from '../../../shared/logging/logger.js';

const PUBLIC_PATHS = [
  '/health',
  '/documentation',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/initOAuth',
  '/documentation/static'
];

export const authMiddleware = async (request, response, next) => {
  const context = {
    requestId: request.id || 'express-req',
    path: request.path
  };

  // Check if path is public
  if (PUBLIC_PATHS.some(path => request.path === path || request.path.startsWith(path))) {
    logAuth(context, 'Skipping auth for public path', { path: request.path });
    return next();
  }

  try {
    logAuth(context, 'Processing authentication', {
      hasAuth: !!request.headers.authorization,
      hasUserId: !!request.headers['x-user-id'],
      path: request.path
    });

    // Extract token, ensuring proper Bearer format
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Invalid Authorization header format. Must be: Bearer <token>',
        401,
        { providedHeader: authHeader }
      );
    }

    const token = authHeader.split(' ')[1];
    const userId = request.headers['x-user-id'];

    if (!token || !userId) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        AUTH_ERRORS.MISSING_HEADERS.message,
        401,
        { missingToken: !token, missingUserId: !userId }
      );
    }

    // Log token details for debugging (excluding sensitive parts)
    console.log('🔑 Token verification attempt:', {
      tokenLength: token?.length,
      hasUserId: !!userId,
      timestamp: new Date().toISOString()
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

    request.user = {
      id: userId,
      token: decoded
    };

    logAuth(context, 'Authentication successful', { userId });
    next();

  } catch (error) {
    logError(context, error);
    response.status(error.status || 401).json(error.toJSON ? error.toJSON() : { 
      error: error.message,
      code: error.code || 'AUTH_ERROR'
    });
  }
}; 