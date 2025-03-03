const db = require('../utils/db');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { v4: uuidv4 } = require('uuid');
const eventEmitter = require('../utils/event-emitter');
const socketManager = require('../utils/socket-manager');
const messageQueue = require('../utils/message-queue');

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
 * Deliver notification in real-time
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

      // Send to all user's active connections
      connections.forEach(socket => {
        socketManager.sendToSocket(socket, 'notification', {
          id: notificationId,
          type,
          content,
          timestamp: new Date().toISOString()
        });

        logger.debug('Notification sent via WebSocket', {
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
 * Get user's unread notifications
 */
async function getUserNotifications(userId, options = { limit: 20, offset: 0, includeRead: false }) {
  try {
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const queryParams = [userId];

    if (!options.includeRead) {
      query += ' AND read = FALSE';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(options.limit, options.offset);

    const notifications = await db.query(query, queryParams);

    logger.debug('Retrieved user notifications', {
      userId,
      count: notifications.length,
      includeRead: options.includeRead
    });

    return notifications.map(notification => ({
      ...notification,
      content: JSON.parse(notification.content)
    }));
  } catch (error) {
    logger.error('Error fetching user notifications', {
      error: error.message,
      userId
    });
    throw error;
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

module.exports = {
  createNotification,
  deliverNotificationRealtime,
  processQueuedNotification,
  getUserNotifications,
  markNotificationAsRead
}; 