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
    
    // Parse query parameters
    const limit = parseInt(request.query.limit) || 10;
    const page = parseInt(request.query.page) || 1;
    const offset = (page - 1) * limit;
    const unreadOnly = request.query.unread === 'true';
    const subscriptionId = request.query.subscriptionId || null;
    
    // Get notifications using the service
    const result = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
      subscriptionId
    });
    
    return reply.status(200).send(result);
  } catch (error) {
    logger.logError({ requestId: request.id, path: request.url }, error, {
      userId: userId
    });
    
    reply.status(500).send({ 
      error: 'Failed to fetch notifications',
      message: error.message 
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