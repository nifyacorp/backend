import { query, setRLSContext } from '../../../infrastructure/database/client.js';
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
    // Set RLS context before querying notifications
    await setRLSContext(userId);
    
    // Explicitly select notification.id to ensure it's properly returned
    let sqlQuery = `
      SELECT n.id, n.user_id, n.subscription_id, n.title, n.content, 
             n.source_url as "sourceUrl", n.read, n.metadata,
             n.created_at as "createdAt", n.read_at as "readAt",
             s.name as subscription_name
      FROM notifications n
      LEFT JOIN subscriptions s ON n.subscription_id = s.id
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
    
    // Enhanced logging for debugging
    console.log('----NOTIFICATION DEBUGGING START----');
    console.log(`Retrieved ${result.rows.length} notifications from database`);
    
    // Log each notification ID and structure
    result.rows.forEach((notification, index) => {
      console.log(`Notification #${index + 1}:`, {
        id: notification.id,
        hasId: !!notification.id,
        idType: typeof notification.id,
        keys: Object.keys(notification),
        userId: notification.user_id,
        title: notification.title?.substring(0, 30) + (notification.title?.length > 30 ? '...' : '')
      });
    });
    
    // Check for any notifications missing ID
    const missingIds = result.rows.filter(n => !n.id);
    if (missingIds.length > 0) {
      console.log(`WARNING: Found ${missingIds.length} notifications with missing IDs`);
      console.log('First notification with missing ID:', missingIds[0]);
    }
    
    // Log the full first notification for inspection
    if (result.rows.length > 0) {
      console.log('Complete first notification object:', JSON.stringify(result.rows[0]));
    }
    
    console.log('----NOTIFICATION DEBUGGING END----');
    
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
    // Set RLS context before counting notifications
    await setRLSContext(userId);
    
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
      paramIndex++; // Increment the parameter index
    }
    
    // Log the count query for debugging
    console.log('Executing notification count query:', {
      query: sqlQuery,
      params: queryParams,
      userId,
      timestamp: new Date().toISOString()
    });
    
    const result = await query(sqlQuery, queryParams);
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'getNotificationCount' }, error, {
      userId,
      unreadOnly,
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
    // Set RLS context before updating notification
    await setRLSContext(userId);
    
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
    // Set RLS context before updating notifications
    await setRLSContext(userId);
    
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
    // Set RLS context before deleting notification
    await setRLSContext(userId);
    
    console.log('Deleting notification in repository:', {
      notificationId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // First verify the notification belongs to the user
    const verifyQuery = `
      SELECT id FROM notifications
      WHERE id = $1 AND user_id = $2
    `;
    
    const verifyResult = await query(verifyQuery, [notificationId, userId]);
    
    if (verifyResult.rows.length === 0) {
      console.error('Notification not found or not owned by user:', {
        notificationId,
        userId,
        timestamp: new Date().toISOString()
      });
      throw new Error('Notification not found or not owned by user');
    }
    
    console.log('Notification ownership verified, proceeding with deletion:', {
      notificationId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Now delete the notification
    const sqlQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification not found or not owned by user');
    }
    
    console.log('Notification successfully deleted:', {
      notificationId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'deleteNotification' }, error, {
      notificationId,
      userId,
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
 * Delete all notifications for a user
 * @param {string} userId - The user's ID
 * @param {string|null} [subscriptionId=null] - Optional subscription ID to filter by
 * @returns {Promise<number>} - Number of notifications deleted
 */
const deleteAllNotifications = async (userId, subscriptionId = null) => {
  try {
    // Set RLS context before deleting notifications
    await setRLSContext(userId);
    
    console.log('Deleting all notifications for user:', {
      userId,
      subscriptionId,
      timestamp: new Date().toISOString()
    });
    
    // First count how many notifications will be deleted for logging purposes
    let countQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
    `;
    
    const countParams = [userId];
    
    if (subscriptionId) {
      countQuery += ` AND subscription_id = $2`;
      countParams.push(subscriptionId);
    }
    
    const countResult = await query(countQuery, countParams);
    const notificationCount = parseInt(countResult.rows[0].count);
    
    console.log(`Found ${notificationCount} notifications to delete for user:`, {
      userId,
      subscriptionId,
      count: notificationCount,
      timestamp: new Date().toISOString()
    });
    
    // Now proceed with deletion
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
    
    console.log('Executing deletion query:', {
      query: sqlQuery.replace(/\s+/g, ' '),
      params: queryParams,
      timestamp: new Date().toISOString()
    });
    
    const result = await query(sqlQuery, queryParams);
    
    console.log('Successfully deleted notifications:', {
      userId,
      subscriptionId,
      deleted: result.rows.length,
      timestamp: new Date().toISOString()
    });
    
    return result.rows.length;
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'deleteAllNotifications' }, error, {
      userId,
      subscriptionId,
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
 * Get notification statistics for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Notification statistics
 */
const getNotificationStats = async (userId) => {
  try {
    // Set RLS context before querying
    await setRLSContext(userId);
    
    // Get total count
    const totalCountQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
    `;
    const totalResult = await query(totalCountQuery, [userId]);
    const total = parseInt(totalResult.rows[0].count);
    
    // Get unread count
    const unreadCountQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read = false
    `;
    const unreadResult = await query(unreadCountQuery, [userId]);
    const unread = parseInt(unreadResult.rows[0].count);
    
    // Get weekly change
    const weeklyChangeQuery = `
      SELECT 
        COALESCE((
          SELECT COUNT(*) 
          FROM notifications 
          WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        ), 0) as current_week,
        COALESCE((
          SELECT COUNT(*) 
          FROM notifications 
          WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'
        ), 0) as previous_week
    `;
    const changeResult = await query(weeklyChangeQuery, [userId]);
    const currentWeek = parseInt(changeResult.rows[0].current_week);
    const previousWeek = parseInt(changeResult.rows[0].previous_week);
    
    // Calculate percentage change
    let change = 0;
    let isIncrease = false;
    
    if (previousWeek > 0) {
      change = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
      isIncrease = currentWeek > previousWeek;
    } else if (currentWeek > 0) {
      change = 100;
      isIncrease = true;
    }
    
    // Get notification count by type
    const byTypeQuery = `
      SELECT 
        COALESCE(source, 'unknown') as type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
      GROUP BY source
      ORDER BY count DESC
    `;
    const byTypeResult = await query(byTypeQuery, [userId]);
    const byType = byTypeResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});
    
    return {
      total,
      unread,
      change,
      isIncrease,
      byType
    };
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'getNotificationStats' }, error, {
      userId,
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
 * Get daily activity statistics for a user
 * @param {string} userId - The user's ID
 * @param {number} [days=7] - Number of days to include
 * @returns {Promise<Object>} - Activity statistics
 */
const getActivityStats = async (userId, days = 7) => {
  try {
    // Set RLS context before querying
    await setRLSContext(userId);
    
    // Get daily activity for the last X days
    const activityByDayQuery = `
      SELECT 
        TO_CHAR(DATE(created_at), 'Dy') as day,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), TO_CHAR(DATE(created_at), 'Dy')
      ORDER BY DATE(created_at)
    `;
    const activityResult = await query(activityByDayQuery, [userId]);
    
    // Get notification count by entity_type (using entity_type instead of source which doesn't exist)
    const bySourceQuery = `
      SELECT 
        COALESCE(SPLIT_PART(entity_type, ':', 1), 'unknown') as name,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
      GROUP BY SPLIT_PART(entity_type, ':', 1)
      ORDER BY count DESC
    `;
    
    // Handle potential query error with a fallback
    let sourcesResult;
    try {
      sourcesResult = await query(bySourceQuery, [userId]);
    } catch (error) {
      logger.logError({ repository: 'notification-repository', method: 'getActivityStats' }, error, {
        userId,
        days,
        error: {
          message: error.message,
          code: error.code,
          detail: error.detail
        }
      });
      
      // Provide fallback data when the query fails
      sourcesResult = { 
        rows: [
          { name: 'unknown', count: '0' }
        ] 
      };
    }
    
    // Create a map for each day of the week
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activityByDay = dayNames.map(day => {
      const found = activityResult.rows.find(r => r.day === day);
      return {
        day,
        count: found ? parseInt(found.count) : 0
      };
    });
    
    // Add color information for each source
    const colorMap = {
      'BOE': '#ff5722',
      'REAL_ESTATE': '#4caf50',
      'SOCIAL_MEDIA': '#9c27b0',
      'NEWS': '#2196f3',
      'unknown': '#607d8b'
    };
    
    const sources = sourcesResult.rows.map(row => ({
      name: row.name,
      count: parseInt(row.count),
      color: colorMap[row.name] || '#607d8b'
    }));
    
    return {
      activityByDay,
      sources
    };
  } catch (error) {
    logger.logError({ repository: 'notification-repository', method: 'getActivityStats' }, error, {
      userId,
      days,
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      }
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
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats
};