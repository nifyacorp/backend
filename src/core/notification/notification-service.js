import notificationRepository from './data/notification-repository.js';
import logger from '../../shared/logger.js';

// Mock data for local development
const mockNotifications = [
  {
    id: '1',
    title: 'Nueva Subvención Disponible',
    content: 'Se ha publicado una nueva subvención para empresas tecnológicas en el BOE.',
    sourceUrl: 'https://boe.es/1234',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    subscription_name: 'Alertas BOE',
    entity_type: 'BOE',
    metadata: { prompt: 'Subvenciones tecnología', matchConfidence: 0.89 }
  },
  {
    id: '2',
    title: 'Oferta de Empleo Público',
    content: 'Convocatoria de 150 plazas para funcionarios de la administración general del estado.',
    sourceUrl: 'https://boe.es/5678',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    subscription_name: 'Oposiciones',
    entity_type: 'BOE',
    metadata: { prompt: 'Oposiciones administración', matchConfidence: 0.92 }
  },
  {
    id: '3',
    title: 'Nuevo Inmueble Disponible',
    content: 'Piso de 90m² en Madrid que coincide con tus criterios de búsqueda.',
    sourceUrl: 'https://idealista.com/inmueble/123456',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    subscription_name: 'Alertas Inmobiliarias',
    entity_type: 'REAL_ESTATE',
    metadata: { prompt: 'Madrid centro 2 habitaciones', matchConfidence: 0.85 }
  },
  {
    id: '4',
    title: 'Actualización Legislativa',
    content: 'Se ha publicado una nueva ley que podría afectar a tu actividad empresarial.',
    sourceUrl: 'https://boe.es/9012',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    subscription_name: 'Legislación Empresas',
    entity_type: 'BOE',
    metadata: { prompt: 'Legislación empresarial', matchConfidence: 0.78 }
  },
  {
    id: '5',
    title: 'Cambio en Normativa Fiscal',
    content: 'Actualización importante en la normativa fiscal que afecta a autónomos.',
    sourceUrl: 'https://boe.es/3456',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    subscription_name: 'Fiscal',
    entity_type: 'BOE',
    metadata: { prompt: 'Normativa autónomos', matchConfidence: 0.91 }
  }
];

/**
 * Get notifications for a user with pagination and filters
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=10] - Number of notifications per page
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {boolean} [options.unreadOnly=false] - Only return unread notifications
 * @param {string|null} [options.subscriptionId=null] - Filter by subscription ID
 * @returns {Promise<Object>} - Notification data with pagination info
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    // Log request parameters for better debugging
    logger.logProcessing({ service: 'notification-service', method: 'getUserNotifications' }, 'Fetching user notifications', {
      userId,
      options,
      timestamp: new Date().toISOString()
    });

    // In development mode, use mock data
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'getUserNotifications' }, 'Using mock notification data in development mode', {
        userId,
        options
      });
      
      // Apply filtering based on options
      let filteredNotifications = [...mockNotifications];
      
      if (options.unreadOnly) {
        filteredNotifications = filteredNotifications.filter(n => !n.read);
      }
      
      const totalCount = filteredNotifications.length;
      const unreadCount = filteredNotifications.filter(n => !n.read).length;
      
      // Apply pagination
      filteredNotifications = filteredNotifications.slice(
        options.offset, 
        options.offset + options.limit
      );
      
      return {
        notifications: filteredNotifications,
        total: totalCount,
        unread: unreadCount,
        page: Math.floor(options.offset / options.limit) + 1,
        limit: options.limit,
        hasMore: totalCount > (options.offset + options.limit)
      };
    }
    
    // In production mode, use the database repository
    try {
      // Get notifications based on options
      const notifications = await notificationRepository.getUserNotifications(userId, options);
      
      // Enhanced debugging to check notifications before returning them
      console.log('----NOTIFICATION SERVICE DEBUGGING START----');
      console.log(`Preparing to return ${notifications.length} notifications to client`);
      
      // Check for any notifications with missing IDs
      const missingIds = notifications.filter(n => !n.id);
      if (missingIds.length > 0) {
        console.log(`WARNING: Found ${missingIds.length} notifications with missing IDs at service level`);
        
        // Log the first problematic notification
        if (missingIds.length > 0) {
          console.log('Example notification with missing ID:', JSON.stringify(missingIds[0]));
        }
      }
      
      // Convert fields to match frontend expectations
      console.log('Converting notification fields to match frontend expectations');
      const processedNotifications = notifications.map(notification => {
        // Ensure the ID is present and correctly cased
        const processedNotification = {
          ...notification,
          // Ensure id is present (should be, but just in case)
          id: notification.id || '',
          // Convert user_id to userId if needed
          userId: notification.userId || notification.user_id,
          // Convert subscription_id to subscriptionId if needed
          subscriptionId: notification.subscriptionId || notification.subscription_id
        };
        
        // Remove any duplicate/case-variant keys
        if (notification.user_id && notification.userId) delete processedNotification.user_id;
        if (notification.subscription_id && notification.subscriptionId) delete processedNotification.subscription_id;
        
        return processedNotification;
      });
      
      // Log a sample of processed notifications
      if (processedNotifications.length > 0) {
        console.log('Sample processed notification:', JSON.stringify(processedNotifications[0]));
        console.log('Keys in processed notification:', Object.keys(processedNotifications[0]));
        console.log('ID present in sample?', !!processedNotifications[0].id);
      }
      
      console.log('----NOTIFICATION SERVICE DEBUGGING END----');
      
      // Get total and unread counts for pagination and badge display
      const totalCount = await notificationRepository.getNotificationCount(userId, false);
      const unreadCount = await notificationRepository.getNotificationCount(userId, true);
      
      // Log successful retrieval
      logger.logProcessing({ service: 'notification-service', method: 'getUserNotifications' }, 'Successfully retrieved notifications', {
        userId,
        count: processedNotifications.length,
        totalCount,
        unreadCount
      });
      
      return {
        notifications: processedNotifications,
        total: totalCount,
        unread: unreadCount,
        page: Math.floor(options.offset / options.limit) + 1,
        limit: options.limit,
        hasMore: totalCount > (options.offset + options.limit)
      };
    } catch (dbError) {
      // Provide detailed error for database-specific failures
      logger.logError({ service: 'notification-service', method: 'getUserNotifications', subMethod: 'database' }, dbError, {
        userId,
        options,
        errorCode: dbError.code,
        errorMessage: dbError.message
      });
      throw dbError;
    }
  } catch (error) {
    // Add comprehensive error logging
    logger.logError({ service: 'notification-service', method: 'getUserNotifications' }, error, {
      userId,
      options,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The updated notification
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    // In development mode, mock the operation
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'markAsRead' }, 'Mock: Marking notification as read', {
        notificationId,
        userId
      });
      
      const mockNotification = mockNotifications.find(n => n.id === notificationId);
      if (!mockNotification) {
        throw new Error('Notification not found or not owned by user');
      }
      
      mockNotification.read = true;
      mockNotification.readAt = new Date().toISOString();
      
      return { ...mockNotification };
    }
    
    return await notificationRepository.markNotificationAsRead(notificationId, userId);
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'markNotificationAsRead' }, error, {
      notificationId,
      userId
    });
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user's ID
 * @param {string|null} subscriptionId - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of updated notifications
 */
const markAllNotificationsAsRead = async (userId, subscriptionId = null) => {
  try {
    // In development mode, mock the operation
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'markAllAsRead' }, 'Mock: Marking all notifications as read', {
        userId
      });
      
      let count = 0;
      mockNotifications.forEach(notification => {
        if (!notification.read) {
          notification.read = true;
          notification.readAt = new Date().toISOString();
          count++;
        }
      });
      
      return { updated: count };
    }
    
    const updated = await notificationRepository.markAllNotificationsAsRead(userId, subscriptionId);
    return { updated };
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'markAllNotificationsAsRead' }, error, {
      userId,
      subscriptionId
    });
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Result indicating successful deletion
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    // In development mode, mock the operation
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'deleteNotification' }, 'Mock: Deleting notification', {
        notificationId,
        userId
      });
      
      const index = mockNotifications.findIndex(n => n.id === notificationId);
      if (index === -1) {
        throw new Error('Notification not found or not owned by user');
      }
      
      mockNotifications.splice(index, 1);
      
      return { deleted: true, id: notificationId };
    }
    
    await notificationRepository.deleteNotification(notificationId, userId);
    return { deleted: true, id: notificationId };
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'deleteNotification' }, error, {
      notificationId,
      userId
    });
    throw error;
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - The user's ID
 * @param {string|null} subscriptionId - Optional subscription ID to filter by
 * @returns {Promise<Object>} - Result with count of deleted notifications
 */
const deleteAllNotifications = async (userId, subscriptionId = null) => {
  try {
    // In development mode, mock the operation
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'deleteAllNotifications' }, 'Mock: Deleting all notifications', {
        userId,
        subscriptionId
      });
      
      const initialLength = mockNotifications.length;
      // Clear all mock notifications (in a real app, we would apply filters)
      mockNotifications.length = 0;
      
      return { deleted: initialLength };
    }
    
    const deleted = await notificationRepository.deleteAllNotifications(userId, subscriptionId);
    return { deleted };
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'deleteAllNotifications' }, error, {
      userId,
      subscriptionId
    });
    throw error;
  }
};

/**
 * Get notification statistics for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The notification statistics
 */
const getNotificationStats = async (userId) => {
  try {
    // In development mode, return mock stats
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'getNotificationStats' }, 'Mock: Getting notification stats', {
        userId
      });
      
      const totalCount = mockNotifications.length;
      const unreadCount = mockNotifications.filter(n => !n.read).length;
      
      return {
        total: totalCount,
        unread: unreadCount,
        change: 10,
        isIncrease: true,
        byCategory: [
          { type: 'BOE', count: mockNotifications.filter(n => n.entity_type === 'BOE').length },
          { type: 'REAL_ESTATE', count: mockNotifications.filter(n => n.entity_type === 'REAL_ESTATE').length }
        ]
      };
    }
    
    return await notificationRepository.getNotificationStats(userId);
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'getNotificationStats' }, error, {
      userId
    });
    throw error;
  }
};

/**
 * Get notification activity statistics for a user
 * @param {string} userId - The user's ID
 * @param {number} days - Number of days to include in the stats
 * @returns {Promise<Object>} - The notification activity data
 */
const getActivityStats = async (userId, days = 7) => {
  try {
    // In development mode, return mock activity data
    if (process.env.NODE_ENV === 'development') {
      logger.logProcessing({ service: 'notification-service', method: 'getActivityStats' }, 'Mock: Getting activity stats', {
        userId,
        days
      });
      
      // Generate mock data for the requested number of days
      const activityData = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        activityData.push({
          date: date.toISOString().split('T')[0],
          count: Math.floor(Math.random() * 5),
          read: Math.floor(Math.random() * 3)
        });
      }
      
      return {
        activity: activityData.reverse(),
        total: mockNotifications.length,
        read: mockNotifications.filter(n => n.read).length,
        days
      };
    }
    
    return await notificationRepository.getActivityStats(userId, days);
  } catch (error) {
    logger.logError({ service: 'notification-service', method: 'getActivityStats' }, error, {
      userId,
      days
    });
    throw error;
  }
};

export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats
};