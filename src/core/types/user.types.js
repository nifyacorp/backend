export const USER_ERRORS = {
  NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User profile not found'
  },
  FETCH_ERROR: {
    code: 'USER_FETCH_ERROR',
    message: 'Failed to fetch user profile'
  },
  UPDATE_ERROR: {
    code: 'USER_UPDATE_ERROR',
    message: 'Failed to update user profile'
  },
  INVALID_THEME: {
    code: 'INVALID_THEME',
    message: 'Invalid theme selection'
  },
  INVALID_LANGUAGE: {
    code: 'INVALID_LANGUAGE',
    message: 'Invalid language selection'
  }
};
};
export const USER_PREFERENCES = {
  THEMES: ['light', 'dark', 'system'],
  LANGUAGES: ['es', 'en', 'ca']