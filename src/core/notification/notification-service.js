import notificationRepository from './data/notification-repository.js';
import logger from '../../shared/logger.js';

/**
 * Get notifications for a user
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @returns {Promise<{notifications: Array, total: number, unread: number}>} - Notifications data
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    // Get notifications based on options
    const notifications = await notificationRepository.getUserNotifications(userId, options);
    
    // Get total and unread counts for pagination and badge display
    const totalCount = await notificationRepository.getNotificationCount(userId, false);
    const unreadCount = await notificationRepository.getNotificationCount(userId, true);
    
    return {
      notifications,
      total: totalCount,
      unread: unreadCount,
      page: Math.floor(options.offset / options.limit) + 1,
      limit: options.limit,
      hasMore: totalCount > (options.offset + options.limit)
    };
  } catch (error) {
    logger.error('Error in notification service getUserNotifications', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The updated notification
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    return await notificationRepository.markNotificationAsRead(notificationId, userId);
  } catch (error) {
    logger.error('Error in notification service markNotificationAsRead', {
      userId,
      notificationId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user's ID
 * @param {string} [subscriptionId] - Optional subscription ID to filter by
 * @returns {Promise<{updated: number}>} - Number of notifications updated
 */
const markAllNotificationsAsRead = async (userId, subscriptionId = null) => {
  try {
    const updatedCount = await notificationRepository.markAllNotificationsAsRead(userId, subscriptionId);
    return { updated: updatedCount };
  } catch (error) {
    logger.error('Error in notification service markAllNotificationsAsRead', {
      userId,
      subscriptionId,
      error: error.message
    });
    throw error;
  }
};

export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
}; 