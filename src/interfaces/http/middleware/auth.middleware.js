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
    logger.logAuth({ requestId: request.id, path: request.url }, 'Processing authentication', {
      hasAuth: !!request.headers[AUTH_HEADER.toLowerCase()],
      hasUserId: !!request.headers[USER_ID_HEADER],
      path: request.url,
      requestId: request.id
    });

    // Extract token, ensuring proper Bearer format
    const authHeader = request.headers[AUTH_HEADER.toLowerCase()];
    if (!authHeader || !authHeader.startsWith(TOKEN_PREFIX)) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        `Invalid ${AUTH_HEADER} header format. Must be: ${TOKEN_PREFIX}<token>`,
        401,
        { providedHeader: authHeader }
      );
    }

    const token = authHeader.split(' ')[1];
    const userId = request.headers[USER_ID_HEADER];

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

    request.user = {
      id: userId,
      token: decoded
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