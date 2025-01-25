import { verifyToken } from '../config/auth.js';

const AUTH_ERRORS = {
  MISSING_HEADERS: {
    code: 'MISSING_HEADERS',
    message: 'Missing required headers'
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid authentication token'
  },
  USER_MISMATCH: {
    code: 'USER_MISMATCH',
    message: 'Token user ID does not match provided user ID'
  }
};

function logAuthError(error, request) {
  console.error('❌ Authentication error:', {
    code: error.code || 'AUTH_ERROR',
    message: error.message,
    path: request.url,
    headers: {
      hasAuth: !!request.headers.authorization,
      hasUserId: !!request.headers['x-user-id']
    },
    timestamp: new Date().toISOString()
  });
}

export async function authenticate(request, reply) {
  if (request.url === '/health' || request.url.startsWith('/documentation')) {
    return;
  }

  try {
    console.log('🔒 Processing authentication:', {
      path: request.url,
      hasAuth: !!request.headers.authorization,
      hasUserId: !!request.headers['x-user-id'],
      timestamp: new Date().toISOString()
    });

    const token = request.headers.authorization?.replace('Bearer ', '');
    const userId = request.headers['x-user-id'];

    if (!token || !userId) {
      const error = {
        ...AUTH_ERRORS.MISSING_HEADERS,
        details: {
          missingToken: !token,
          missingUserId: !userId
        }
      };
      throw error;
    }

    console.log('🔑 Verifying token for user:', {
      userId,
      timestamp: new Date().toISOString()
    });

    const decoded = verifyToken(token);
    
    if (decoded.sub !== userId) {
      console.log('⚠️ User ID mismatch:', {
        tokenUserId: decoded.sub,
        headerUserId: userId,
        timestamp: new Date().toISOString()
      });
      throw AUTH_ERRORS.USER_MISMATCH;
    }

    // Decorate request with user context
    request.user = {
      id: userId,
      token: decoded
    };

    console.log('✅ Authentication successful:', {
      userId,
      hasUser: !!request.user,
      userIdMatch: request.user?.id === userId,
      path: request.url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logAuthError(error, request);
    return reply.code(401).send({
      error: 'Unauthorized',
      code: error.code || 'AUTH_ERROR',
      message: error.message
    });
  }
}