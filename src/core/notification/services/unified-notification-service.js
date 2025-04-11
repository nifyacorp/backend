import logger from '../../../shared/logger.js';
import notificationRepository from '../repository/core-notification-repository.js';
import metrics from '../../../infrastructure/metrics/metrics.js';
import eventEmitter from '../../../infrastructure/events/event-emitter.js';
import pubsubClient from '../../../infrastructure/pubsub/pubsub-client.js';

/**
 * Unified notification service that will be the single source of truth
 * for notification functionality in the application.
 */

/**
 * Create a notification for a user
 * @param {Object} notification - Notification data
 * @param {string} notification.userId - The user ID
 * @param {string} notification.type - The notification type
 * @param {Object|string} notification.content - The notification content
 * @param {string} [notification.transactionId] - Optional transaction ID for tracing
 * @returns {Promise<Object>} - Created notification
 */
async function createNotification({ userId, type, content, transactionId, subscriptionId }) {
  const correlationId = transactionId || `notification-${Date.now()}`;
  logger.debug('Creating notification', { userId, type, correlationId });

  try {
    // Prepare notification data
    const notificationData = {
      userId,
      type,
      content,
      subscriptionId,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Create notification using repository
    const notificationId = await notificationRepository.createNotification(notificationData);
    
    // Emit event for listeners
    eventEmitter.emit('NOTIFICATION_CREATED', {
      notificationId, 
      userId, 
      type, 
      content,
      correlationId
    });
    
    // Trigger email notification if needed
    await sendEmailNotification({
      notificationId,
      userId,
      type,
      content,
      transactionId: correlationId
    });
    
    // Record metrics
    metrics.increment('notification.created', { type, userId });
    
    return {
      id: notificationId,
      userId,
      type,
      content,
      read: false,
      createdAt: notificationData.createdAt
    };
  } catch (error) {
    logger.error('Error creating notification', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      type, 
      correlationId 
    });
    
    metrics.increment('notification.error', { type, reason: 'creation_failed' });
    
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Notifications with pagination info
 */
async function getUserNotifications(userId, options = {}) {
  logger.debug('Getting user notifications', { userId, options });
  
  try {
    // Normalize options for repository
    const normalizedOptions = {
      limit: parseInt(options.limit) || 20,
      offset: parseInt(options.offset) || 0,
      includeRead: options.unreadOnly !== true,
      subscriptionId: options.subscriptionId || null
    };
    
    // Get notifications from repository
    const notifications = await notificationRepository.getUserNotifications(userId, normalizedOptions);
    
    // Get total count for pagination
    const total = await notificationRepository.countUnreadNotifications(userId);
    
    // Return formatted result
    return {
      notifications,
      total,
      unread: await notificationRepository.countUnreadNotifications(userId),
      page: Math.floor(normalizedOptions.offset / normalizedOptions.limit) + 1,
      limit: normalizedOptions.limit,
      hasMore: notifications.length >= normalizedOptions.limit
    };
  } catch (error) {
    logger.error('Error getting user notifications', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      options 
    });
    
    // Return empty result instead of throwing
    return {
      notifications: [],
      total: 0,
      unread: 0,
      page: 1,
      limit: parseInt(options.limit) || 20,
      hasMore: false
    };
  }
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function markNotificationAsRead(notificationId, userId) {
  logger.debug('Marking notification as read', { notificationId, userId });
  
  try {
    // Use repository to mark notification read
    const success = await notificationRepository.markNotificationAsRead(notificationId, userId);
    
    // Track metrics
    if (success) {
      metrics.increment('notification.marked_read', { userId });
    }
    
    return success;
  } catch (error) {
    logger.error('Error marking notification as read', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user ID
 * @param {string} [subscriptionId] - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of updated notifications
 */
async function markAllNotificationsAsRead(userId, subscriptionId = null) {
  logger.debug('Marking all notifications as read', { userId, subscriptionId });
  
  try {
    // Use repository to mark all notifications read
    const updatedCount = await notificationRepository.markAllNotificationsAsRead(userId, subscriptionId);
    
    // Track metrics
    metrics.increment('notification.bulk_marked_read', { userId, count: updatedCount });
    
    return {
      updated: updatedCount
    };
  } catch (error) {
    logger.error('Error marking all notifications as read', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      subscriptionId 
    });
    
    throw error;
  }
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Result indicating success
 */
async function deleteNotification(notificationId, userId) {
  logger.debug('Deleting notification', { notificationId, userId });
  
  try {
    // Use repository to delete notification
    const success = await notificationRepository.deleteNotification(notificationId, userId);
    
    // Track metrics
    if (success) {
      metrics.increment('notification.deleted', { userId });
    }
    
    return {
      deleted: success,
      id: notificationId
    };
  } catch (error) {
    logger.error('Error deleting notification', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    
    throw error;
  }
}

/**
 * Delete all notifications for a user
 * @param {string} userId - The user ID
 * @param {string} [subscriptionId] - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of deleted notifications
 */
async function deleteAllNotifications(userId, subscriptionId = null) {
  logger.debug('Deleting all notifications', { userId, subscriptionId });
  
  try {
    // Use repository to delete all notifications
    const deletedCount = await notificationRepository.deleteAllNotifications(userId, { subscriptionId });
    
    // Track metrics
    metrics.increment('notification.bulk_deleted', { userId, count: deletedCount });
    
    return {
      deleted: deletedCount
    };
  } catch (error) {
    logger.error('Error deleting all notifications', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      subscriptionId 
    });
    
    throw error;
  }
}

/**
 * Get notification statistics for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Notification statistics
 */
async function getNotificationStats(userId) {
  logger.debug('Getting notification stats', { userId });
  
  try {
    // Use repository to get notification stats
    return await notificationRepository.getNotificationStats(userId);
  } catch (error) {
    logger.error('Error getting notification stats', { 
      error: error.message, 
      stack: error.stack,
      userId 
    });
    
    // Return empty stats instead of throwing
    return {
      total: 0,
      unread: 0,
      byType: {}
    };
  }
}

/**
 * Get notification activity data for a user
 * @param {string} userId - The user ID
 * @param {number} [days=7] - Number of days to include
 * @returns {Promise<Object>} - Activity data
 */
async function getActivityStats(userId, days = 7) {
  logger.debug('Getting activity stats', { userId, days });
  
  try {
    // Use repository to get activity stats
    return await notificationRepository.getActivityStats(userId, days);
  } catch (error) {
    logger.error('Error getting activity stats', { 
      error: error.message, 
      stack: error.stack,
      userId,
      days
    });
    
    // Return empty activity data instead of throwing
    return {
      activityByDay: [],
      sources: []
    };
  }
}

/**
 * Send an email notification
 * @param {Object} data - Email notification data
 * @private
 */
async function sendEmailNotification({ notificationId, userId, type, content, transactionId }) {
  try {
    // Get user email preferences
    const userPrefs = await notificationRepository.getUserEmailPreferences(userId);
    
    // Skip if user doesn't want email notifications
    if (!userPrefs || !userPrefs.email_notifications) {
      return;
    }
    
    // Get email address to use
    const email = userPrefs.notification_email || userPrefs.email;
    if (!email) {
      logger.warn('Cannot send email notification: no email address', { userId });
      return;
    }
    
    // Extract title from content based on type
    let title = '';
    if (typeof content === 'object') {
      if (content.title) {
        title = content.title;
      } else if (content.name) {
        title = content.name;
      } else if (type) {
        title = `New ${type} notification`;
      }
    } else {
      title = `New ${type} notification`;
    }
    
    // Determine if this is a test user and should get immediate notifications
    const isTestUser = email === process.env.TEST_EMAIL || email === 'nifyacorp@gmail.com';
    const topicName = isTestUser ? 'email-notifications-immediate' : 'email-notifications-daily';
    
    // Publish to email notification topic
    await pubsubClient.publishMessage(topicName, {
      userId,
      email,
      notification: {
        id: notificationId,
        type,
        title,
        content,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      correlationId: transactionId
    });
    
    logger.debug('Published email notification to topic', { 
      notificationId, 
      userId, 
      email, 
      topic: topicName 
    });
    
    // Track metrics
    metrics.increment('notification.email_queued', { type, userId, immediate: isTestUser });
  } catch (error) {
    logger.error('Error sending email notification', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    
    // Do not rethrow - email notification failure should not break the main flow
  }
}

export {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats
}; 