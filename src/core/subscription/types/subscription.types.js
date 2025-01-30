export const SUBSCRIPTION_TYPES = {
  BOE: 'boe',
  REAL_ESTATE: 'real-estate'
};

export const SUBSCRIPTION_FREQUENCIES = {
  IMMEDIATE: 'immediate',
  DAILY: 'daily'
};

export const SUBSCRIPTION_ERRORS = {
  NOT_FOUND: {
    code: 'SUBSCRIPTION_NOT_FOUND',
    message: 'Subscription not found'
  },
  FETCH_ERROR: {
    code: 'SUBSCRIPTION_FETCH_ERROR',
    message: 'Failed to fetch subscription'
  },
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Template not found'
  },
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