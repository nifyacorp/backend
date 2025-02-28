import notificationService from '../../notification-service.js';
import logger from '../../../../shared/logger.js';

/**
 * Get notifications for a user
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const getUserNotifications = async (request, reply) => {
  try {
    // The userId comes from the authenticated user
    const userId = request.user.id;
    
    // Log incoming request details for debugging
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Processing notification request', {
      userId,
      query: request.query,
      path: request.url
    });
    
    // Parse and validate query parameters with defaults and safeguards
    const limit = Math.min(parseInt(request.query.limit) || 10, 100); // Cap max limit at 100
    const page = Math.max(parseInt(request.query.page) || 1, 1); // Ensure page is at least 1
    const offset = (page - 1) * limit;
    const unreadOnly = request.query.unread === 'true';
    const subscriptionId = request.query.subscriptionId || null;
    
    // Log parsed options for debugging
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Parsed query parameters', {
      limit,
      page,
      offset,
      unreadOnly,
      subscriptionId,
      userId
    });
    
    // Get notifications using the service
    try {
      const result = await notificationService.getUserNotifications(userId, {
        limit,
        offset,
        unreadOnly,
        subscriptionId
      });
      
      return reply.status(200).send(result);
    } catch (serviceError) {
      logger.logError({ controller: 'notification-controller', method: 'getUserNotifications' }, serviceError, {
        userId,
        query: request.query,
        message: 'Error calling notification service'
      });
      
      return reply.status(500).send({
        error: 'Failed to retrieve notifications',
        message: 'An error occurred while retrieving your notifications'
      });
    }
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'getUserNotifications' }, error, {
      path: request.url,
      query: request.query,
      error: error.message,
      stack: error.stack
    });
    
    return reply.status(500).send({
      error: 'Server error',
      message: 'An unexpected error occurred'
    });
  }
};

/**
 * Mark a notification as read
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const markAsRead = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { notificationId } = request.params;
    
    if (!notificationId) {
      return reply.status(400).send({ error: 'Notification ID is required' });
    }
    
    const result = await notificationService.markNotificationAsRead(notificationId, userId);
    
    return reply.status(200).send(result);
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      userId: request.user?.id,
      notificationId: request.params.notificationId
    });
    return reply.status(500).send({ 
      error: 'Failed to mark notification as read', 
      message: error.message 
    });
  }
};

/**
 * Mark all notifications as read for a user
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const markAllAsRead = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { subscriptionId } = request.query;
    
    const result = await notificationService.markAllNotificationsAsRead(userId, subscriptionId);
    
    return reply.status(200).send(result);
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      userId: request.user?.id,
      subscriptionId: request.query.subscriptionId
    });
    return reply.status(500).send({ 
      error: 'Failed to mark all notifications as read', 
      message: error.message 
    });
  }
};

/**
 * Delete a notification
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const deleteNotification = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { notificationId } = request.params;
    
    if (!notificationId) {
      return reply.status(400).send({ error: 'Notification ID is required' });
    }
    
    const result = await notificationService.deleteNotification(notificationId, userId);
    
    return reply.status(200).send(result);
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      userId: request.user?.id,
      notificationId: request.params.notificationId
    });
    
    if (error.message.includes('not found')) {
      return reply.status(404).send({ 
        error: 'Notification not found', 
        message: error.message 
      });
    }
    
    return reply.status(500).send({ 
      error: 'Failed to delete notification', 
      message: error.message 
    });
  }
};

/**
 * Delete all notifications for a user
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const deleteAllNotifications = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { subscriptionId } = request.query;
    
    const result = await notificationService.deleteAllNotifications(userId, subscriptionId);
    
    return reply.status(200).send(result);
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      userId: request.user?.id,
      subscriptionId: request.query.subscriptionId
    });
    return reply.status(500).send({ 
      error: 'Failed to delete notifications', 
      message: error.message 
    });
  }
};

export default {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
}; 