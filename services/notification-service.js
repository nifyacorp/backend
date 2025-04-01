const db = require('../utils/db');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { v4: uuidv4 } = require('uuid');
const eventEmitter = require('../utils/event-emitter');
const socketManager = require('../utils/socket-manager');
const messageQueue = require('../utils/message-queue');
const pubsubClient = require('../utils/pubsub-client');
const { normalizeNotification, extractNotificationTitle, isDuplicateNotification } = require('../utils/notification-helper');

/**
 * Create a notification
 */
async function createNotification({ userId, type, content, transactionId }) {
  logger.debug('Creating notification', {
    userId,
    type,
    content,
    transactionId
  });

  try {
    // Phase 5: Notification Persistence
    // Notification Database Operations
    const notificationData = {
      userId,
      type,
      content: JSON.stringify(content),
      read: false,
      createdAt: new Date().toISOString()
    };

    logger.debug('Creating notification record', {
      notificationData,
      correlationId: transactionId
    });

    // Store notification in database
    const result = await db.query(
      'INSERT INTO notifications (user_id, type, content, read, created_at) VALUES (?, ?, ?, ?, ?)',
      [notificationData.userId, notificationData.type, notificationData.content, notificationData.read, notificationData.createdAt]
    );

    const notificationId = result.insertId;
    logger.debug('Notification created', {
      notificationId,
      correlationId: transactionId
    });

    // If we're using a message queue, publish to it
    if (process.env.USE_MESSAGE_QUEUE === 'true') {
      // Phase 4: Notification Generation
      // Event Queue Monitoring
      await messageQueue.publish('notifications', '', {
        type: 'NOTIFICATION_CREATED',
        payload: {
          notificationId,
          userId,
          type,
          content
        },
        correlationId: transactionId
      });

      logger.debug('Notification published to queue', {
        notificationId,
        queue: 'notifications',
        correlationId: transactionId
      });
    } else {
      // If not using a queue, emit event directly
      eventEmitter.emit('NOTIFICATION_CREATED', {
        notificationId,
        userId,
        type,
        content,
        correlationId: transactionId
      });

      logger.debug('Notification event emitted directly', {
        notificationId,
        eventType: 'NOTIFICATION_CREATED',
        correlationId: transactionId
      });
    }

    // Phase 6: Real-time Notification Delivery
    // Deliver notification in real-time
    await deliverNotificationRealtime({
      notificationId,
      userId,
      type,
      content,
      transactionId
    });

    // Phase 7: Email Notification Delivery
    // Check if user has email notifications enabled
    try {
      const userResult = await db.query(
        'SELECT email_notifications, notification_email, email FROM users WHERE id = ?',
        [userId]
      );

      if (userResult.length > 0 && userResult[0].email_notifications) {
        // Extract notification title for email
        const title = extractNotificationTitle(content, type, userId);
        
        // Use notification_email if available, otherwise use account email
        const email = userResult[0].notification_email || userResult[0].email;
        
        if (email) {
          // Publish to email notification topic
          await publishToEmailNotificationTopic({
            notificationId,
            userId,
            email,
            notification: {
              id: notificationId,
              type,
              title,
              content,
              timestamp: new Date().toISOString()
            },
            transactionId
          });
          
          logger.debug('Email notification published', {
            notificationId,
            userId,
            email,
            correlationId: transactionId
          });
        }
      }
    } catch (emailError) {
      // Log but don't fail the entire notification process
      logger.error('Error publishing email notification', {
        error: emailError.message,
        stack: emailError.stack,
        notificationId,
        userId,
        correlationId: transactionId
      });
    }

    metrics.increment('notification.created', { 
      type,
      userId
    });

    return {
      id: notificationId,
      userId,
      type,
      content,
      read: false
    };
  } catch (error) {
    logger.error('Error creating notification', {
      error: error.message,
      stack: error.stack,
      userId,
      type,
      correlationId: transactionId
    });

    metrics.increment('notification.error', { 
      type,
      reason: 'creation_failed'
    });

    throw error;
  }
}

/**
 * Deliver notification in real-time with standardized format
 * 
 * @param {Object} params Delivery parameters
 * @param {string} params.notificationId The notification ID
 * @param {string} params.userId The user ID
 * @param {string} params.type The notification type
 * @param {Object} params.content The notification content
 * @param {string} params.transactionId Correlation ID for tracing
 * @returns {Promise<boolean>} Success indicator
 */
async function deliverNotificationRealtime({ notificationId, userId, type, content, transactionId }) {
  logger.debug('Attempting real-time notification delivery', {
    notificationId,
    userId,
    type,
    correlationId: transactionId
  });

  try {
    // WebSocket Connection Logging
    const connections = socketManager.getConnectionsByUserId(userId);
    
    if (connections && connections.length > 0) {
      logger.debug('User has active WebSocket connections', {
        userId,
        connectionCount: connections.length,
        correlationId: transactionId
      });

      // Create a standardized notification object matching frontend expectations
      const notificationObj = {
        id: notificationId,
        userId: userId,
        type: type,
        title: extractNotificationTitle(content, type, userId),
        content: typeof content === 'string' ? content : JSON.stringify(content),
        metadata: content.metadata || {},
        entity_type: content.entity_type || '',
        subscriptionId: content.subscriptionId || content.subscription_id || '',
        subscription_name: content.subscription_name || content.subscriptionName || '',
        sourceUrl: content.sourceUrl || content.source_url || content.url || '',
        read: false,
        createdAt: new Date().toISOString()
      };
      
      // Run the notification through our normalizer to ensure consistent format
      const normalizedNotification = normalizeNotification({
        id: notificationId,
        user_id: userId,
        type,
        content: typeof content === 'object' ? JSON.stringify(content) : content,
        read: false,
        created_at: new Date().toISOString()
      });

      // Send to all user's active connections
      connections.forEach(socket => {
        socketManager.sendToSocket(socket, 'notification', normalizedNotification);

        logger.debug('Notification sent via WebSocket with standardized format', {
          userId,
          notificationId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
          correlationId: transactionId
        });
      });

      metrics.increment('notification.delivered_realtime', { 
        type,
        userId,
        deliveryMethod: 'websocket'
      });
    } else {
      logger.debug('No active WebSocket connections for user', {
        userId,
        correlationId: transactionId
      });

      metrics.increment('notification.delivery_deferred', { 
        reason: 'no_active_connections',
        userId
      });
    }

    return true;
  } catch (error) {
    logger.error('Error delivering notification in real-time', {
      error: error.message,
      stack: error.stack,
      notificationId,
      userId,
      correlationId: transactionId
    });

    metrics.increment('notification.delivery_error', { 
      type,
      reason: error.message,
      userId
    });

    // Don't throw - we don't want to fail the whole operation if real-time delivery fails
    return false;
  }
}

/**
 * Process notification from message queue
 */
async function processQueuedNotification(message) {
  logger.debug('Notification service received event', {
    eventType: message.type,
    correlationId: message.correlationId,
    processingTime: new Date().toISOString()
  });

  try {
    if (message.type === 'NOTIFICATION_CREATED') {
      const { notificationId, userId, type, content } = message.payload;
      
      // Deliver the notification in real-time
      await deliverNotificationRealtime({
        notificationId,
        userId,
        type,
        content,
        transactionId: message.correlationId
      });
    }

    return true;
  } catch (error) {
    logger.error('Error processing queued notification', {
      error: error.message,
      correlationId: message.correlationId,
      messageType: message.type
    });

    metrics.increment('notification.queue_processing_error', { 
      type: message.type
    });

    return false;
  }
}

/**
 * Get user's notifications with standardized format
 * 
 * @param {string} userId - The user ID
 * @param {Object} options - Query options including pagination and filters
 * @param {number} options.limit - Maximum number of notifications to return
 * @param {number} options.offset - Offset for pagination
 * @param {boolean} options.includeRead - Whether to include read notifications
 * @param {string} options.subscriptionId - Filter by subscription ID (optional)
 * @returns {Promise<Array>} Array of standardized notification objects
 */
async function getUserNotifications(userId, options = { limit: 20, offset: 0, includeRead: false, subscriptionId: null }) {
  try {
    // Start building the base query
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const queryParams = [userId];

    // Apply read/unread filter
    if (!options.includeRead) {
      query += ' AND read = FALSE';
    }
    
    // Apply subscription filter if provided
    if (options.subscriptionId) {
      // Filter by subscription ID using JSON_EXTRACT to look within the content JSON
      query += ' AND JSON_EXTRACT(content, "$.subscriptionId") = ? OR JSON_EXTRACT(content, "$.subscription_id") = ?';
      queryParams.push(options.subscriptionId, options.subscriptionId);
    }

    // Add sorting and pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(options.limit, options.offset);

    // Execute the query
    const notifications = await db.query(query, queryParams);

    logger.debug('Retrieved user notifications', {
      userId,
      count: notifications.length,
      includeRead: options.includeRead,
      subscriptionId: options.subscriptionId || 'all'
    });

    // Process all notifications through our improved normalizer to ensure consistent format
    return notifications.map(notification => {
      try {
        // Use our centralized normalizer which now matches frontend expectations exactly
        return normalizeNotification(notification);
      } catch (error) {
        logger.error('Error normalizing notification', {
          error: error.message,
          notification_id: notification.id
        });
        
        // Use the normalizer's error fallback for consistent error handling
        return normalizeNotification({
          id: notification.id || `error-${Date.now()}`,
          user_id: userId,
          type: 'ERROR',
          read: false,
          created_at: new Date().toISOString(),
          content: JSON.stringify({ 
            error: 'Error processing notification',
            originalError: error.message 
          })
        });
      }
    });
  } catch (error) {
    logger.error('Error fetching user notifications', {
      error: error.message,
      stack: error.stack,
      userId,
      options
    });
    // Return empty array instead of throwing to prevent frontend errors
    return [];
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    const result = await db.query(
      'UPDATE notifications SET read = TRUE WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    logger.debug('Notification marked as read', {
      notificationId,
      userId,
      updated: result.affectedRows > 0
    });

    return result.affectedRows > 0;
  } catch (error) {
    logger.error('Error marking notification as read', {
      error: error.message,
      notificationId,
      userId
    });
    throw error;
  }
}

/**
 * Delete a notification
 */
async function deleteNotification(notificationId, userId) {
  try {
    // First try with user_id to ensure ownership
    logger.debug('Attempting to delete notification with ownership check', {
      notificationId,
      userId
    });

    const resultWithOwnership = await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (resultWithOwnership.affectedRows > 0) {
      logger.debug('Notification deleted successfully with ownership check', {
        notificationId,
        userId,
        deleted: true
      });
      
      metrics.increment('notification.deleted', { 
        reason: 'explicit_request',
        userId
      });
      
      return true;
    }

    // If no rows affected, try to check if notification exists first
    const exists = await db.query(
      'SELECT 1 FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (exists.length === 0) {
      // Notification doesn't exist, consider it "deleted" for UI consistency
      logger.debug('Notification doesn\'t exist, considering it deleted', {
        notificationId,
        userId
      });
      
      metrics.increment('notification.already_deleted', { 
        userId
      });
      
      return true;
    }

    logger.warn('Failed to delete notification - ownership mismatch', {
      notificationId,
      userId,
      exists: exists.length > 0
    });
    
    return false;
  } catch (error) {
    logger.error('Error deleting notification', {
      error: error.message,
      stack: error.stack,
      notificationId,
      userId
    });
    
    metrics.increment('notification.delete_error', { 
      reason: error.message,
      userId
    });
    
    throw error;
  }
}

/**
 * Delete all notifications for a user
 */
async function deleteAllNotifications(userId, { subscriptionId } = {}) {
  try {
    let query = 'DELETE FROM notifications WHERE user_id = ?';
    const params = [userId];
    
    if (subscriptionId) {
      query += ' AND JSON_EXTRACT(content, "$.subscriptionId") = ?';
      params.push(subscriptionId);
    }
    
    const result = await db.query(query, params);
    
    logger.debug('Deleted all notifications', {
      userId,
      subscriptionId: subscriptionId || 'all',
      affectedRows: result.affectedRows
    });
    
    metrics.increment('notification.bulk_deleted', { 
      count: result.affectedRows,
      userId
    });
    
    return result.affectedRows;
  } catch (error) {
    logger.error('Error deleting all notifications', {
      error: error.message,
      stack: error.stack,
      userId,
      subscriptionId: subscriptionId || 'all'
    });
    
    metrics.increment('notification.bulk_delete_error', { 
      reason: error.message,
      userId
    });
    
    throw error;
  }
}

/**
 * Publish to email notification topic based on user preferences
 */
async function publishToEmailNotificationTopic({ notificationId, userId, email, notification, transactionId }) {
  try {
    // For demonstration purpose, we'll check if this is a test user to send immediate notifications
    const isTestUser = email === process.env.TEST_EMAIL || email === 'nifyacorp@gmail.com';
    
    // Choose topic based on user preferences and notification type
    const topicName = isTestUser ? 'email-notifications-immediate' : 'email-notifications-daily';
    
    // Publish message
    await pubsubClient.publishMessage(topicName, {
      userId,
      email,
      notification,
      timestamp: new Date().toISOString(),
      correlationId: transactionId
    });
    
    logger.debug(`Published notification to ${topicName}`, {
      notificationId,
      userId,
      email,
      topicName,
      correlationId: transactionId
    });
    
    // Track email notification in metrics
    metrics.increment('notification.email_queued', {
      type: notification.type,
      userId,
      immediate: isTestUser
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to publish email notification', {
      error: error.message,
      stack: error.stack,
      notificationId,
      userId,
      correlationId: transactionId
    });
    
    metrics.increment('notification.email_publish_error', {
      type: notification.type,
      userId,
      error: error.code || 'unknown'
    });
    
    return false;
  }
}

/**
 * Count unread notifications for a user
 */
async function countUnreadNotifications(userId) {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = FALSE',
      [userId]
    );
    
    const count = result[0].count || 0;
    
    logger.debug('Counted unread notifications', {
      userId,
      count
    });
    
    return count;
  } catch (error) {
    logger.error('Error counting unread notifications', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    // Return 0 to avoid breaking the UI
    return 0;
  }
}

module.exports = {
  createNotification,
  deliverNotificationRealtime,
  processQueuedNotification,
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  deleteAllNotifications,
  publishToEmailNotificationTopic,
  countUnreadNotifications
}; 