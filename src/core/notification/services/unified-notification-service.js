import logger from '../../../shared/logger.js';
import notificationRepository from '../repository/core-notification-repository.js';
import metrics from '../../../infrastructure/metrics/metrics.js';
import eventEmitter from '../../../infrastructure/events/event-emitter.js';
import pubsubClient from '../../../infrastructure/pubsub/pubsub-client.js';

/**
 * Unified notification service that will be the single source of truth
 * for notification functionality in the application.
 */

// Helper function to handle logging safely
function safeLog(level, message, meta = {}) {
  try {
    if (level === 'error' && typeof logger.error === 'function') {
      logger.error(message, meta);
    } else if (level === 'error' && typeof logger.logError === 'function') {
      logger.logError(meta, message);
    } else if (level === 'debug' && typeof logger.debug === 'function') {
      logger.debug(message, meta);
    } else if (level === 'debug' && typeof logger.logDebug === 'function') {
      logger.logDebug(meta, message);
    } else if (level === 'warn' && typeof logger.warn === 'function') {
      logger.warn(message, meta);
    } else if (level === 'warn' && typeof logger.logWarn === 'function') {
      logger.logWarn(meta, message);
    } else if (typeof logger.log === 'function') {
      logger.log(level, message, meta);
    } else {
      console[level === 'debug' ? 'log' : level](message, meta);
    }
  } catch (err) {
    console.error('Error using logger:', err);
    console[level === 'debug' ? 'log' : level](message, meta);
  }
}

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
  
  try {
    if (typeof logger.logDebug === 'function') {
      logger.logDebug({ userId, correlationId }, 'Creating notification', { type });
    }

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
    safeLog('error', 'Error creating notification', { 
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
  try {
    if (typeof logger.logDebug === 'function') {
      logger.logDebug({ userId }, 'Getting user notifications', { options });
    }
    
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
    safeLog('error', 'Error getting user notifications', { 
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
  logger.logDebug({ userId }, 'Marking notification as read', { notificationId });
  
  try {
    // Use repository to mark notification read
    const success = await notificationRepository.markNotificationAsRead(notificationId, userId);
    
    // Track metrics
    if (success) {
      metrics.increment('notification.marked_read', { userId });
    }
    
    return success;
  } catch (error) {
    safeLog('error', 'Error marking notification as read', { 
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
 * @param {string} [subscriptionId] - Optional subscription ID to filter
 * @returns {Promise<Object>} - Result with count of marked notifications
 */
async function markAllNotificationsAsRead(userId, subscriptionId) {
  logger.logDebug({ userId }, 'Marking all notifications as read', { subscriptionId });
  
  try {
    // Use repository to mark all notifications read
    const updatedCount = await notificationRepository.markAllNotificationsAsRead(userId, subscriptionId);
    
    // Track metrics
    metrics.increment('notification.bulk_marked_read', { userId, count: updatedCount });
    
    return {
      updated: updatedCount
    };
  } catch (error) {
    safeLog('error', 'Error marking all notifications as read', { 
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
  logger.logDebug({ userId }, 'Deleting notification', { notificationId });
  
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
    safeLog('error', 'Error deleting notification', { 
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
 * @param {string} [subscriptionId] - Optional subscription ID to filter
 * @returns {Promise<Object>} - Result with count of deleted notifications
 */
async function deleteAllNotifications(userId, subscriptionId) {
  logger.logDebug({ userId }, 'Deleting all notifications', { subscriptionId });
  
  try {
    // Use repository to delete all notifications
    const deletedCount = await notificationRepository.deleteAllNotifications(userId, { subscriptionId });
    
    // Track metrics
    metrics.increment('notification.bulk_deleted', { userId, count: deletedCount });
    
    return {
      deleted: deletedCount
    };
  } catch (error) {
    safeLog('error', 'Error deleting all notifications', { 
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
  logger.logDebug({ userId }, 'Getting notification stats');
  
  try {
    // Use repository to get notification stats
    return await notificationRepository.getNotificationStats(userId);
  } catch (error) {
    safeLog('error', 'Error getting notification stats', { 
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
  try {
    if (typeof logger.logDebug === 'function') {
      logger.logDebug({ userId }, 'Getting notification activity stats', { days });
    }
    
    // Get activity stats from repository
    return await notificationRepository.getActivityStats(userId, days);
  } catch (error) {
    safeLog('error', 'Error getting activity stats', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      days 
    });
    
    // Return empty stats if there's an error
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
    if (!userPrefs || userPrefs.email_notifications === false) {
      return;
    }
    
    // Get email address to use
    const email = userPrefs.notification_email || userPrefs.email;
    if (!email) {
      safeLog('error', 'Cannot send email notification: no email address', { userId });
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
    
    if (typeof logger.logDebug === 'function') {
      logger.logDebug({ userId, correlationId: transactionId }, 'Published email notification to topic', { 
        notificationId, 
        email, 
        topic: topicName 
      });
    }
  } catch (error) {
    safeLog('error', 'Error sending email notification', {
      error: error.message,
      stack: error.stack,
      userId,
      notificationId,
      type
    });
  }
}

/**
 * Get a notification by ID
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} - Notification object or null if not found
 */
async function getNotificationById(notificationId, userId) {
  logger.logDebug({ userId }, 'Getting notification by ID', { notificationId });
  
  try {
    // Use repository to get notification
    const notification = await notificationRepository.getNotificationById(notificationId, userId);
    
    if (!notification) {
      return null;
    }
    
    return notification;
  } catch (error) {
    safeLog('error', 'Error getting notification by ID', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    
    throw error;
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
  getActivityStats,
  getNotificationById
}; 