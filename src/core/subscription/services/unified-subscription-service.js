import logger from '../../../shared/logger.js';
import subscriptionRepository from '../repository/core-subscription-repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';

/**
 * Unified subscription service that will be the single source of truth
 * for subscription functionality in the application.
 */

/**
 * Create a new subscription
 * @param {Object} data - Subscription data 
 * @param {string} data.name - Name of the subscription
 * @param {string} data.userId - User ID who owns the subscription
 * @param {string} data.typeId - Type ID of subscription
 * @param {Array|string} data.prompts - Search prompts/keywords
 * @param {string} [data.description] - Optional description
 * @param {string} [data.frequency='daily'] - Notification frequency
 * @param {boolean} [data.active=true] - Whether the subscription is active
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Created subscription
 */
async function createSubscription(data, context = {}) {
  logger.logInfo(context, 'Creating subscription', { ...data, userId: data.userId });
  
  try {
    // Validate required fields
    if (!data.name) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Subscription name is required',
        400
      );
    }
    
    if (!data.typeId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Subscription type is required',
        400
      );
    }
    
    if (!data.prompts || (Array.isArray(data.prompts) && data.prompts.length === 0)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'At least one search prompt is required',
        400
      );
    }
    
    // Create the subscription
    const subscription = await subscriptionRepository.createSubscription(data);
    
    return subscription;
  } catch (error) {
    logger.logInfo(context, 'Error creating subscription', {
      error: error.message,
      stack: error.stack,
      data
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      SUBSCRIPTION_ERRORS.CREATE_ERROR.code,
      SUBSCRIPTION_ERRORS.CREATE_ERROR.message,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get a subscription by ID
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Subscription object
 */
async function getSubscriptionById(userId, subscriptionId, context = {}) {
  logger.logInfo(context, 'Getting subscription by ID', { userId, subscriptionId });
  
  try {
    const subscription = await subscriptionRepository.findById(subscriptionId, {
      userId,
      withUserCheck: true,
      context
    });
    
    if (!subscription) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId }
      );
    }
    
    return subscription;
  } catch (error) {
    logger.logInfo(context, 'Error getting subscription by ID', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
      SUBSCRIPTION_ERRORS.FETCH_ERROR.message,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get subscriptions for a user
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @param {boolean} [options.active] - Filter by active status
 * @param {string} [options.type] - Filter by subscription type
 * @param {string} [options.search] - Search in name and description
 * @param {number} [options.limit=20] - Maximum number to return
 * @param {number} [options.page=1] - Page number
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Object with subscriptions array and pagination info
 */
async function getUserSubscriptions(userId, options = {}, context = {}) {
  logger.logInfo(context, 'Getting user subscriptions', { userId, options });
  
  try {
    const result = await subscriptionRepository.getUserSubscriptions(userId, options);
    
    // Log the raw results for debugging
    logger.logInfo(context, 'Subscription retrieval result', {
      userId,
      count: result.subscriptions.length,
      ids: result.subscriptions.map(s => s.id),
      total: result.pagination.total
    });
    
    return result;
  } catch (error) {
    logger.logInfo(context, 'Error getting user subscriptions', {
      error: error.message,
      stack: error.stack,
      userId,
      options
    });
    
    // Return empty results instead of throwing
    return {
      subscriptions: [],
      pagination: {
        total: 0,
        page: parseInt(options.page || 1),
        limit: parseInt(options.limit || 20),
        totalPages: 0
      }
    };
  }
}

/**
 * Update a subscription
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} data - Fields to update
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Updated subscription
 */
async function updateSubscription(userId, subscriptionId, data, context = {}) {
  logger.logInfo(context, 'Updating subscription', { userId, subscriptionId, data });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Update the subscription
    const updatedSubscription = await subscriptionRepository.updateSubscription(
      subscriptionId,
      data,
      { userId, context }
    );
    
    return updatedSubscription;
  } catch (error) {
    logger.logInfo(context, 'Error updating subscription', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId,
      data
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
      SUBSCRIPTION_ERRORS.UPDATE_ERROR.message,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Delete a subscription
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteSubscription(userId, subscriptionId, context = {}) {
  logger.logInfo(context, 'Deleting subscription', { userId, subscriptionId });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Delete the subscription
    const result = await subscriptionRepository.deleteSubscription(
      subscriptionId,
      { userId, context }
    );
    
    return result;
  } catch (error) {
    logger.logInfo(context, 'Error deleting subscription', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      SUBSCRIPTION_ERRORS.DELETE_ERROR.code,
      SUBSCRIPTION_ERRORS.DELETE_ERROR.message,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get subscription statistics for a user
 * @param {string} userId - User ID
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Statistics object
 */
async function getSubscriptionStats(userId, context = {}) {
  logger.logInfo(context, 'Getting subscription stats', { userId });
  
  try {
    return await subscriptionRepository.getSubscriptionStats(userId);
  } catch (error) {
    logger.logInfo(context, 'Error getting subscription stats', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    // Return default stats instead of throwing
    return {
      total: 0,
      active: 0,
      inactive: 0,
      bySource: {},
      byFrequency: {}
    };
  }
}

/**
 * Toggle subscription status
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {boolean} active - New active status
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Updated subscription
 */
async function toggleSubscriptionStatus(userId, subscriptionId, active, context = {}) {
  logger.logInfo(context, 'Toggling subscription status', { userId, subscriptionId, active });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Toggle status
    const updatedSubscription = await subscriptionRepository.toggleSubscriptionStatus(
      subscriptionId,
      active,
      { userId, context }
    );
    
    return updatedSubscription;
  } catch (error) {
    logger.logInfo(context, 'Error toggling subscription status', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId,
      active
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
      'Failed to toggle subscription status',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Share a subscription with another user
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} targetEmail - Email of user to share with
 * @param {string} message - Optional message
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Sharing result
 */
async function shareSubscription(userId, subscriptionId, targetEmail, message, context = {}) {
  logger.logInfo(context, 'Sharing subscription', { userId, subscriptionId, targetEmail });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Share the subscription
    const result = await subscriptionRepository.shareSubscription(
      subscriptionId,
      userId,
      targetEmail,
      message
    );
    
    return result;
  } catch (error) {
    logger.logInfo(context, 'Error sharing subscription', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId,
      targetEmail
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      'SHARING_ERROR',
      'Failed to share subscription',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Remove subscription sharing
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} targetEmail - Email of user to remove sharing with
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Result of operation
 */
async function removeSubscriptionSharing(userId, subscriptionId, targetEmail, context = {}) {
  logger.logInfo(context, 'Removing subscription sharing', { userId, subscriptionId, targetEmail });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Remove sharing
    const result = await subscriptionRepository.removeSubscriptionSharing(
      subscriptionId,
      userId,
      targetEmail
    );
    
    return result;
  } catch (error) {
    logger.logInfo(context, 'Error removing subscription sharing', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId,
      targetEmail
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      'SHARING_ERROR',
      'Failed to remove subscription sharing',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Process a subscription (run search against data source)
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} - Processing result
 */
async function processSubscription(userId, subscriptionId, context = {}) {
  const transactionId = context.transactionId || `sub-process-${Date.now()}`;
  logger.logInfo(context, 'Processing subscription', { userId, subscriptionId, transactionId });
  
  try {
    // Verify subscription exists and user has permission
    await getSubscriptionById(userId, subscriptionId, context);
    
    // Process the subscription
    const result = await subscriptionRepository.processSubscription(
      subscriptionId,
      { userId, transactionId, context }
    );
    
    return result;
  } catch (error) {
    logger.logInfo(context, 'Error processing subscription', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId,
      transactionId
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      'PROCESSING_ERROR',
      'Failed to process subscription',
      500,
      { originalError: error.message }
    );
  }
}

export {
  createSubscription,
  getSubscriptionById,
  getUserSubscriptions,
  updateSubscription,
  deleteSubscription,
  getSubscriptionStats,
  toggleSubscriptionStatus,
  shareSubscription,
  removeSubscriptionSharing,
  processSubscription
}; 