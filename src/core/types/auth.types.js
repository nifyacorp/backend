export const AUTH_ERRORS = {
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
  },
  SECRET_ERROR: {
    code: 'SECRET_ERROR',
    message: 'Authentication service unavailable'
  },
  // Firebase-specific error codes
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Authentication token has expired'
  },
  TOKEN_REVOKED: {
    code: 'TOKEN_REVOKED',
    message: 'Authentication token has been revoked'
  },
  FIREBASE_ERROR: {
    code: 'FIREBASE_ERROR',
    message: 'Firebase authentication error'
  }
};