export const SUBSCRIPTION_TYPES = {
  BOE: 'BOE',
  REAL_ESTATE: 'Inmobiliaria'
};

export const SUBSCRIPTION_FREQUENCIES = {
  IMMEDIATE: 'immediate',
  DAILY: 'daily'
};

export const SUBSCRIPTION_ERRORS = {
  TYPE_NOT_FOUND: {
    code: 'TYPE_NOT_FOUND',
    message: 'Subscription type not found'
  },
  INVALID_PROMPTS: {
    code: 'INVALID_PROMPTS',
    message: 'Maximum 3 prompts allowed'
  },
  CREATE_ERROR: {
    code: 'CREATE_ERROR',
    message: 'Failed to create subscription'
  },
  UPDATE_ERROR: {
    code: 'UPDATE_ERROR',
    message: 'Failed to update subscription'
  },
  DELETE_ERROR: {
    code: 'DELETE_ERROR',
    message: 'Failed to delete subscription'
  }
};