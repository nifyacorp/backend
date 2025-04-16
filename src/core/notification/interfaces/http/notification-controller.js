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
    
    // More detailed debugging for raw notifications
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Raw notifications received', {
      count: (result.notifications || []).length,
      fields: result.notifications && result.notifications.length > 0 
        ? Object.keys(result.notifications[0] || {}) 
        : [],
      firstNotification: result.notifications && result.notifications.length > 0 
        ? JSON.stringify(result.notifications[0]).substring(0, 100) + '...' 
        : 'No notifications'
    });
    
    // Format result to match frontend expectations
    // Ensure notifications have consistent format
    const formattedNotifications = (result.notifications || []).map(notification => {
      // Validate notification has required fields
      if (!notification || !notification.id) {
        logger.logWarn({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Skipping invalid notification', {
          notification: JSON.stringify(notification)
        });
        return null; // Will be filtered out later
      }
      
      const formatted = {
        id: notification.id,
        title: notification.title || '',
        content: notification.content || '',
        read: !!notification.read,
        createdAt: notification.createdAt || notification.created_at || new Date().toISOString(),
        readAt: notification.readAt || notification.read_at || null,
        sourceUrl: notification.sourceUrl || notification.source_url || '',
        subscriptionId: notification.subscriptionId || notification.subscription_id || null,
        subscriptionName: notification.subscriptionName || notification.subscription_name || '',
        source: notification.source || '',
        data: notification.data || {},
        metadata: notification.metadata || {},
        entityType: notification.entityType || notification.entity_type || 'notification:generic'
      };
      
      return formatted;
    })
    .filter(Boolean); // Remove null entries
    
    // Log the formatted notifications for debugging
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Formatted notifications', {
      originalCount: (result.notifications || []).length,
      formattedCount: formattedNotifications.length,
      sample: formattedNotifications.length > 0 ? {
        id: formattedNotifications[0].id,
        fields: Object.keys(formattedNotifications[0])
      } : 'No notifications'
    });
    
    const response = {
      notifications: formattedNotifications,
      total: result.total || 0,
      unread: result.unread || 0,
      page: page,
      limit: limit,
      totalPages: Math.ceil((result.total || 0) / limit)
    };
    
    // Check for empty notifications and add debug info
    if (formattedNotifications.length === 0 && result.total > 0) {
      logger.logWarn({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Returning empty notifications despite non-zero total', {
        userId,
        total: result.total,
        unread: result.unread,
        requestedPage: page,
        requestedLimit: limit
      });
      
      // Debug: check raw notifications
      if (result.notifications && result.notifications.length > 0) {
        logger.logWarn({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Raw notifications exist but formatted ones are empty', {
          rawCount: result.notifications.length,
          firstRawNotification: JSON.stringify(result.notifications[0]).substring(0, 200)
        });
        
        // If we have raw notifications but formatted ones are empty, 
        // try to fix them directly with minimal formatting
        formattedNotifications.push(...result.notifications.map(n => ({
          id: n.id || `temp-${Math.random().toString(36).substring(2, 15)}`,
          title: n.title || 'Notification title missing',
          content: typeof n.content === 'string' ? n.content : 'Content unavailable',
          read: !!n.read,
          createdAt: n.createdAt || n.created_at || new Date().toISOString(),
          sourceUrl: n.sourceUrl || n.source_url || '',
          entityType: n.entityType || n.entity_type || 'notification:generic'
        })));
        
        logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Created simple fallback notifications', {
          count: formattedNotifications.length
        });
        
        // Update response
        response.notifications = formattedNotifications;
      }
    }
    
    // Log response count for debugging
    logger.logProcessing({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Returning notifications', {
      userId,
      count: response.notifications.length,
      total: response.total,
      unread: response.unread
    });
    
    return reply.send(response);
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'getUserNotifications' }, 'Error getting user notifications', {
      error: error.message,
      stack: error.stack
    });
    
    // If we're in development mode, provide test data instead of failing
    if (process.env.NODE_ENV === 'development') {
      console.log('Providing test notification data for development');
      return reply.send({
        notifications: [
          {
            id: 'test-1',
            title: 'Test Notification 1',
            content: 'This is a test notification from the backend.',
            read: false,
            createdAt: new Date().toISOString(),
            metadata: { type: 'test', source: 'backend' }
          },
          {
            id: 'test-2',
            title: 'Another Test Notification',
            content: 'This is another test notification with more content for testing purposes.',
            read: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            metadata: { type: 'test', source: 'backend' }
          }
        ],
        total: 2,
        unread: 1,
        page: request.query.page || 1,
        limit: request.query.limit || 10,
        hasMore: false
      });
    }
    
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
    
    return reply.status(error.status || 500).send({
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
      status: 'success',
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
      status: 'success',
      message: 'All notifications deleted successfully',
      deleted: result.deleted,
      data: { count: result.deleted }
    });
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'deleteAllNotifications' }, error, {
      userId: request.user?.id,
      subscriptionId: request.query?.subscriptionId
    });
    
    return reply.status(error.status || 500).send({
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
    
    // If we're in development mode, provide test data instead of failing
    if (process.env.NODE_ENV === 'development') {
      console.log('Providing test notification stats for development');
      return reply.send({
        total: 5,
        unread: 2,
        change: 20,
        isIncrease: true,
        byType: {
          'boe': 3,
          'real-estate': 2
        }
      });
    }
    
    return reply.status(error.status || 500).send({
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
    
    // If we're in development mode, provide test data instead of failing
    if (process.env.NODE_ENV === 'development') {
      console.log('Providing test notification activity data for development');
      
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const activityByDay = dayNames.map(day => ({
        day,
        count: Math.floor(Math.random() * 5)
      }));
      
      return reply.send({
        activityByDay,
        sources: [
          { name: 'boe', count: 12, color: '#ff5722' },
          { name: 'real-estate', count: 8, color: '#4caf50' }
        ]
      });
    }
    
    return reply.status(error.status || 500).send({
      error: 'Failed to fetch notification activity data',
      message: error.message
    });
  }
};

/**
 * Get a notification by ID
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<void>}
 */
const getNotificationById = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { notificationId } = request.params;
    
    logger.logProcessing({ controller: 'notification-controller', method: 'getNotificationById' }, 'Getting notification by ID', {
      userId,
      notificationId
    });
    
    const notification = await notificationService.getNotificationById(notificationId, userId);
    
    if (!notification) {
      return reply.status(404).send({
        error: 'Notification not found',
        message: `No notification found with id ${notificationId}`
      });
    }
    
    return reply.send(notification);
  } catch (error) {
    logger.logError({ controller: 'notification-controller', method: 'getNotificationById' }, 'Error getting notification by ID', {
      error: error.message,
      stack: error.stack
    });
    
    return reply.status(500).send({
      error: 'Failed to retrieve notification',
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
  getActivityStats,
  getNotificationById
};