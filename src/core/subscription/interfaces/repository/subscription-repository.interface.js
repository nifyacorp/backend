/**
 * @interface SubscriptionRepositoryInterface
 * This interface defines the standard contract for subscription repositories
 * in the system. All subscription repositories should implement these methods.
 */

/**
 * Create a subscription
 * @param {Object} subscription - The subscription data
 * @param {string} subscription.name - Name of the subscription
 * @param {string} subscription.userId - User ID who owns the subscription
 * @param {string} subscription.typeId - Type ID of subscription
 * @param {Array|string} subscription.prompts - Search prompts/keywords
 * @param {string} [subscription.description] - Optional description
 * @param {string} [subscription.frequency='daily'] - Notification frequency
 * @param {boolean} [subscription.active=true] - Whether the subscription is active
 * @returns {Promise<Object>} - Created subscription with ID
 */
async function createSubscription(subscription) {
  throw new Error('Method not implemented');
}

/**
 * Get a subscription by ID
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @param {boolean} [options.withUserCheck=true] - Whether to check user ownership
 * @param {string} [options.userId] - User ID for ownership check
 * @returns {Promise<Object|null>} - Subscription or null if not found
 */
async function findById(id, options = {}) {
  throw new Error('Method not implemented');
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
 * @returns {Promise<Object>} - Object with subscriptions array and pagination info
 */
async function getUserSubscriptions(userId, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Update a subscription
 * @param {string} id - Subscription ID
 * @param {Object} data - Fields to update
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for ownership check
 * @returns {Promise<Object>} - Updated subscription
 */
async function updateSubscription(id, data, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Delete a subscription
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for ownership check
 * @param {boolean} [options.force=false] - Force deletion even if not owner
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteSubscription(id, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Get subscription statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Statistics object
 */
async function getSubscriptionStats(userId) {
  throw new Error('Method not implemented');
}

/**
 * Toggle subscription active status
 * @param {string} id - Subscription ID
 * @param {boolean} active - New active status
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for ownership check
 * @returns {Promise<Object>} - Updated subscription
 */
async function toggleSubscriptionStatus(id, active, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Share a subscription with another user
 * @param {string} id - Subscription ID
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} targetEmail - Email of user to share with
 * @param {string} [message] - Optional message
 * @returns {Promise<Object>} - Sharing result
 */
async function shareSubscription(id, ownerUserId, targetEmail, message) {
  throw new Error('Method not implemented');
}

/**
 * Remove subscription sharing
 * @param {string} id - Subscription ID
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} targetEmail - Email of user to remove sharing with
 * @returns {Promise<Object>} - Result of operation
 */
async function removeSubscriptionSharing(id, ownerUserId, targetEmail) {
  throw new Error('Method not implemented');
}

/**
 * Process subscription (run search against data source)
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for ownership check
 * @param {string} [options.transactionId] - For tracking the operation
 * @returns {Promise<Object>} - Processing result
 */
async function processSubscription(id, options = {}) {
  throw new Error('Method not implemented');
}

export default {
  createSubscription,
  findById,
  getUserSubscriptions,
  updateSubscription,
  deleteSubscription,
  getSubscriptionStats,
  toggleSubscriptionStatus,
  shareSubscription,
  removeSubscriptionSharing,
  processSubscription
}; 