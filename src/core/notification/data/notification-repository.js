import { dbPool } from '../../../database/client.js';
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
    let query = `
      SELECT n.*, s.name as subscription_name, s.entity_type
      FROM notifications n
      JOIN subscriptions s ON n.subscription_id = s.id
      WHERE n.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    if (unreadOnly) {
      query += ` AND n.read = false`;
    }
    
    if (subscriptionId) {
      query += ` AND n.subscription_id = $${paramIndex}`;
      queryParams.push(subscriptionId);
      paramIndex++;
    }
    
    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const result = await dbPool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in getUserNotifications', {
      userId,
      options,
      error: error.message
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
    let query = `
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE n.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    if (unreadOnly) {
      query += ` AND n.read = false`;
    }
    
    if (subscriptionId) {
      query += ` AND n.subscription_id = $${paramIndex}`;
      queryParams.push(subscriptionId);
    }
    
    const result = await dbPool.query(query, queryParams);
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error('Error in getNotificationCount', {
      userId,
      unreadOnly,
      subscriptionId,
      error: error.message
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
    const query = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await dbPool.query(query, [notificationId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification not found or not owned by user');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error in markNotificationAsRead', {
      notificationId,
      userId,
      error: error.message
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
    let query = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE user_id = $1 AND read = false
    `;
    
    const queryParams = [userId];
    
    if (subscriptionId) {
      query += ` AND subscription_id = $2`;
      queryParams.push(subscriptionId);
    }
    
    query += ` RETURNING id`;
    
    const result = await dbPool.query(query, queryParams);
    return result.rows.length;
  } catch (error) {
    logger.error('Error in markAllNotificationsAsRead', {
      userId,
      subscriptionId,
      error: error.message
    });
    throw error;
  }
};

export default {
  getUserNotifications,
  getNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
}; 