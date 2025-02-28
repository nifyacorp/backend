import notificationRepository from '../data/notification-repository.js';
import logger from '../../../shared/logger.js';

/**
 * Get notifications for a user with pagination and filters
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Number of notifications per page
 * @param {boolean} [options.unread=false] - Only return unread notifications
 * @param {string|null} [options.subscriptionId=null] - Filter by subscription ID
 * @returns {Promise<Object>} - Notification data with pagination info
 */
const getUserNotifications = async (userId, options = {}) => {
  // ... existing code ...
};

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The updated notification
 */
const markNotificationAsRead = async (notificationId, userId) => {
  // ... existing code ...
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user's ID
 * @param {string|null} [subscriptionId=null] - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of updated notifications
 */
const markAllNotificationsAsRead = async (userId, subscriptionId = null) => {
  // ... existing code ...
};

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Result of the deletion operation
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    logger.logInfo({ service: 'notification-service', method: 'deleteNotification' }, 'Deleting notification', { notificationId, userId });
    
    const deleted = await notificationRepository.deleteNotification(notificationId, userId);
    
    return {
      success: deleted,
      message: 'Notification deleted successfully'
    };
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'deleteNotification' }, error, {
      notificationId,
      userId
    });
    
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - The user's ID
 * @param {string|null} [subscriptionId=null] - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of deleted notifications
 */
const deleteAllNotifications = async (userId, subscriptionId = null) => {
  try {
    logger.logInfo({ service: 'notification-service', method: 'deleteAllNotifications' }, 'Deleting all notifications', {
      userId,
      subscriptionId
    });
    
    const deletedCount = await notificationRepository.deleteAllNotifications(userId, subscriptionId);
    
    return {
      success: true,
      deleted: deletedCount,
      message: `${deletedCount} notifications deleted successfully`
    };
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'deleteAllNotifications' }, error, {
      userId,
      subscriptionId
    });
    
    throw new Error(`Failed to delete notifications: ${error.message}`);
  }
};

export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications
}; 