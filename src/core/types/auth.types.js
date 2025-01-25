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
  }
};