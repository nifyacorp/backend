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

export async function authenticate(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url
  };

  // Check if path is public
  if (PUBLIC_PATHS.some(path => request.url === path || request.url.startsWith(path))) {
    logAuth(context, 'Skipping auth for public path', { path: request.url });
    return;
  }

  try {
    logAuth(context, 'Processing authentication', {
      hasAuth: !!request.headers.authorization,
      hasUserId: !!request.headers['x-user-id'],
      path: request.url
    });

    const token = request.headers.authorization?.replace('Bearer ', '');
    const userId = request.headers['x-user-id'];

    if (!token || !userId) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        AUTH_ERRORS.MISSING_HEADERS.message,
        401,
        { missingToken: !token, missingUserId: !userId }
      );
    }

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

  } catch (error) {
    logError(context, error);
    reply.code(error.status || 401).send(error.toJSON());
    return reply;
  }
  return;
}