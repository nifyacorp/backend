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
      userId,
      limit,
      page,
      offset,
      unreadOnly,
      subscriptionId
    });
    
    // Call service with options
    const result = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
      subscriptionId
    });
    
    // Format result to match frontend expectations
    const response = {
      notifications: result.notifications || [],
      total: result.total || 0,
      unread: result.unread || 0,
      page: page,
      limit: limit,
      totalPages: Math.ceil((result.total || 0) / limit)
    };
    
    // Log response count for debugging
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Returning notifications', {
      userId,
      count: response.notifications.length,
      total: response.total,
      unread: response.unread
    });
    
    return reply.send(response);
  } catch (error) {
    // Log detailed error for debugging
    logger.logError({ controller: 'notification-controller', method: 'getUserNotifications' }, error, {
      userId: request.user?.id,
      query: request.query
    });
    
    return reply.status(500).send({
      error: 'Failed to retrieve notifications',
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
    
    logger.logProcessing({ controller: 'notification-controller', method: 'markAsRead' }, 'Marking notification as read', {
      userId,
      notificationId
    });
    
    const updatedNotification = await notificationService.markNotificationAsRead(notificationId, userId);
    
    return reply.send({
      message: 'Notification marked as read',
      notification: updatedNotification
    });
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'markAsRead' }, error, {
      userId: request.user?.id,
      notificationId: request.params?.notificationId
    });
    
    return reply.status(error.status || 500).send({
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
};

/**
 * Mark all notifications as read
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const markAllAsRead = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { subscriptionId } = request.query;
    
    logger.logProcessing({ controller: 'notification-controller', method: 'markAllAsRead' }, 'Marking all notifications as read', {
      userId,
      subscriptionId
    });
    
    const result = await notificationService.markAllNotificationsAsRead(userId, subscriptionId);
    
    return reply.send({
      message: 'All notifications marked as read',
      updated: result.updated
    });
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'markAllAsRead' }, error, {
      userId: request.user?.id,
      subscriptionId: request.query?.subscriptionId
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
    
    logger.logProcessing({ controller: 'notification-controller', method: 'deleteNotification' }, 'Deleting notification', {
      userId,
      notificationId
    });
    
    // Log request details more extensively for debugging
    console.log('Handling DELETE request for notification:', {
      url: request.url,
      method: request.method,
      params: request.params,
      userId,
      notificationId,
      timestamp: new Date().toISOString()
    });
    
    const result = await notificationService.deleteNotification(notificationId, userId);
    
    // Log successful deletion result
    console.log('Successfully deleted notification:', {
      userId,
      notificationId,
      result,
      timestamp: new Date().toISOString()
    });
    
    return reply.send({
      message: 'Notification deleted successfully',
      id: notificationId
    });
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'deleteNotification' }, error, {
      userId: request.user?.id,
      notificationId: request.params?.notificationId,
      errorType: error.constructor.name,
      errorMessage: error.message
    });
    
    // Log error details more extensively for debugging
    console.error('Error deleting notification:', {
      userId: request.user?.id,
      notificationId: request.params?.notificationId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
    
    return reply.status(error.status || 500).send({
      error: 'Failed to delete notification',
      message: error.message
    });
  }
};

/**
 * Delete all notifications
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const deleteAllNotifications = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { subscriptionId } = request.query;
    
    logger.logProcessing({ controller: 'notification-controller', method: 'deleteAllNotifications' }, 'Deleting all notifications', {
      userId,
      subscriptionId
    });
    
    const result = await notificationService.deleteAllNotifications(userId, subscriptionId);
    
    return reply.send({
      message: 'All notifications deleted successfully',
      deleted: result.deleted
    });
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'deleteAllNotifications' }, error, {
      userId: request.user?.id,
      subscriptionId: request.query?.subscriptionId
    });
    
    return reply.status(500).send({
      error: 'Failed to delete notifications',
      message: error.message
    });
  }
};

/**
 * Get notification statistics
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const getNotificationStats = async (request, reply) => {
  try {
    const userId = request.user.id;
    
    logger.logProcessing({ controller: 'notification-controller', method: 'getNotificationStats' }, 'Fetching notification statistics', {
      userId
    });
    
    const stats = await notificationService.getNotificationStats(userId);
    
    return reply.send(stats);
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'getNotificationStats' }, error, {
      userId: request.user?.id
    });
    
    return reply.status(500).send({
      error: 'Failed to fetch notification statistics',
      message: error.message
    });
  }
};

/**
 * Get notification activity data
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const getActivityStats = async (request, reply) => {
  try {
    const userId = request.user.id;
    const days = parseInt(request.query.days) || 7;
    
    logger.logProcessing({ controller: 'notification-controller', method: 'getActivityStats' }, 'Fetching notification activity', {
      userId,
      days
    });
    
    const activityData = await notificationService.getActivityStats(userId, days);
    
    return reply.send(activityData);
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'getActivityStats' }, error, {
      userId: request.user?.id,
      days: request.query?.days
    });
    
    return reply.status(500).send({
      error: 'Failed to fetch notification activity data',
      message: error.message
    });
  }
};

export default {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats
};