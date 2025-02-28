import { query } from '../../../infrastructure/database/client.js';
import logger from '../../../shared/logger.js';

/**
 * Get notifications for a user with pagination and filters
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=10] - Number of notifications to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {boolean} [options.unreadOnly=false] - Only return unread notifications
 * @param {string|null} [options.subscriptionId=null] - Filter by subscription ID
 * @returns {Promise<Array>} - Array of notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  const {
    limit = 10,
    offset = 0,
    unreadOnly = false,
    subscriptionId = null
  } = options;

  try {
    // Start with a simpler query without JOIN to isolate potential issues
    let sqlQuery = `
      SELECT n.*
      FROM notifications n
      WHERE n.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    if (unreadOnly) {
      sqlQuery += ` AND n.read = false`;
    }
    
    if (subscriptionId) {
      sqlQuery += ` AND n.subscription_id = $${paramIndex}`;
      queryParams.push(subscriptionId);
      paramIndex++;
    }
    
    sqlQuery += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    // Log the query for debugging
    console.log('Executing notification query:', {
      query: sqlQuery,
      params: queryParams,
      userId,
      timestamp: new Date().toISOString()
    });
    
    const result = await query(sqlQuery, queryParams);
    
    // Log the query result summary for debugging
    console.log('Query result summary:', {
      rowCount: result.rowCount,
      timestamp: new Date().toISOString()
    });
    
    return result.rows;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'getUserNotifications' }, error, {
      userId,
      options,
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      }
    });
    throw error;
  }
};

/**
 * Get notification count for a user
 * @param {string} userId - The user's ID
 * @param {boolean} [unreadOnly=false] - Count only unread notifications
 * @param {string|null} [subscriptionId=null] - Filter by subscription ID
 * @returns {Promise<number>} - Count of notifications
 */
const getNotificationCount = async (userId, unreadOnly = false, subscriptionId = null) => {
  try {
    let sqlQuery = `
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE n.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    if (unreadOnly) {
      sqlQuery += ` AND n.read = false`;
    }
    
    if (subscriptionId) {
      sqlQuery += ` AND n.subscription_id = $${paramIndex}`;
      queryParams.push(subscriptionId);
    }
    
    const result = await query(sqlQuery, queryParams);
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'getUnreadCount' }, error, {
      userId,
      subscriptionId
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
    const sqlQuery = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification not found or not owned by user');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'markNotificationAsRead' }, error, {
      notificationId,
      userId
    });
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user's ID
 * @param {string|null} [subscriptionId=null] - Optional subscription ID to filter by
 * @returns {Promise<number>} - Number of notifications updated
 */
const markAllNotificationsAsRead = async (userId, subscriptionId = null) => {
  try {
    let sqlQuery = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE user_id = $1 AND read = false
    `;
    
    const queryParams = [userId];
    
    if (subscriptionId) {
      sqlQuery += ` AND subscription_id = $2`;
      queryParams.push(subscriptionId);
    }
    
    sqlQuery += ` RETURNING id`;
    
    const result = await query(sqlQuery, queryParams);
    return result.rows.length;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'markAllNotificationsAsRead' }, error, {
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
 * @returns {Promise<boolean>} - True if the notification was deleted
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const sqlQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification not found or not owned by user');
    }
    
    return true;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'deleteNotification' }, error, {
      notificationId,
      userId
    });
    throw error;
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - The user's ID
 * @param {string|null} [subscriptionId=null] - Optional subscription ID to filter by
 * @returns {Promise<number>} - Number of notifications deleted
 */
const deleteAllNotifications = async (userId, subscriptionId = null) => {
  try {
    let sqlQuery = `
      DELETE FROM notifications
      WHERE user_id = $1
    `;
    
    const queryParams = [userId];
    
    if (subscriptionId) {
      sqlQuery += ` AND subscription_id = $2`;
      queryParams.push(subscriptionId);
    }
    
    sqlQuery += ` RETURNING id`;
    
    const result = await query(sqlQuery, queryParams);
    return result.rows.length;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'deleteAllNotifications' }, error, {
      userId,
      subscriptionId
    });
    throw error;
  }
};

export default {
  getUserNotifications,
  getNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications
}; 