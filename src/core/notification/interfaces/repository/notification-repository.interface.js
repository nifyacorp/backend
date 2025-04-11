/**
 * @interface NotificationRepositoryInterface
 * This interface defines the standard contract for notification repositories
 * in the system. All notification repositories should implement these methods.
 */

/**
 * Create a notification
 * @param {Object} notification - The notification data
 * @param {string} notification.userId - User ID who will receive the notification
 * @param {string} notification.type - Type of notification
 * @param {string|Object} notification.content - Content of the notification (will be stringified if object)
 * @param {boolean} [notification.read=false] - Whether the notification has been read
 * @param {string} [notification.createdAt] - Creation timestamp
 * @returns {Promise<string>} - ID of the created notification
 */
async function createNotification(notification) {
  throw new Error('Method not implemented');
}

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=20] - Maximum number of notifications to retrieve
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {boolean} [options.includeRead=true] - Whether to include read notifications
 * @param {string} [options.subscriptionId] - Filter by subscription ID
 * @returns {Promise<Array>} - Array of notification objects
 */
async function getUserNotifications(userId, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function markNotificationAsRead(notificationId, userId) {
  throw new Error('Method not implemented');
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user ID
 * @param {string} [subscriptionId] - Optional subscription ID to filter by
 * @returns {Promise<number>} - Number of notifications marked as read
 */
async function markAllNotificationsAsRead(userId, subscriptionId = null) {
  throw new Error('Method not implemented');
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteNotification(notificationId, userId) {
  throw new Error('Method not implemented');
}

/**
 * Delete all notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @param {string} [options.subscriptionId] - Filter by subscription ID
 * @returns {Promise<number>} - Number of notifications deleted
 */
async function deleteAllNotifications(userId, options = {}) {
  throw new Error('Method not implemented');
}

/**
 * Count unread notifications for a user
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Count of unread notifications
 */
async function countUnreadNotifications(userId) {
  throw new Error('Method not implemented');
}

/**
 * Get notification statistics for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Statistics object with counts and breakdowns
 */
async function getNotificationStats(userId) {
  throw new Error('Method not implemented');
}

/**
 * Get notification activity statistics for a user
 * @param {string} userId - The user ID
 * @param {number} [days=7] - Number of days to include in the statistics
 * @returns {Promise<Object>} - Activity statistics
 */
async function getActivityStats(userId, days = 7) {
  throw new Error('Method not implemented');
}

/**
 * Get user email preferences for notifications
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} - User email preferences
 */
async function getUserEmailPreferences(userId) {
  throw new Error('Method not implemented');
}

export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  countUnreadNotifications,
  getNotificationStats,
  getActivityStats,
  getUserEmailPreferences
}; 