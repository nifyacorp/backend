import { query, setRLSContext } from '../../../infrastructure/database/client.js';
import logger from '../../../shared/logger.js';
import notificationRepositoryInterface from '../interfaces/repository/notification-repository.interface.js';

/**
 * Core implementation of the notification repository
 * This is the primary implementation that should be used across the system
 */

/**
 * Create a notification
 * @param {Object} notification - The notification data
 * @returns {Promise<string>} - ID of the created notification
 */
async function createNotification(notification) {
  try {
    // Set RLS context for security
    await setRLSContext(notification.userId);
    
    // Normalize the content
    const content = typeof notification.content === 'object' 
      ? JSON.stringify(notification.content) 
      : notification.content;
    
    // Prepare creation timestamp
    const createdAt = notification.createdAt || new Date().toISOString();
    
    const sqlQuery = `
      INSERT INTO notifications (
        user_id, 
        title, 
        content, 
        source_url,
        read, 
        created_at,
        subscription_id,
        entity_type,
        source,
        data,
        metadata
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;
    
    const params = [
      notification.userId,
      notification.title,
      content,
      notification.sourceUrl || null,
      notification.read || false,
      createdAt,
      notification.subscriptionId || null,
      notification.entityType || 'notification:generic',
      notification.source || null,
      notification.data ? JSON.stringify(notification.data) : null,
      notification.metadata ? JSON.stringify(notification.metadata) : null
    ];
    
    const result = await query(sqlQuery, params);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create notification');
    }
    
    return result.rows[0].id;
  } catch (error) {
    logger.error('Error creating notification', { 
      error: error.message, 
      stack: error.stack,
      userId: notification.userId 
    });
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of notification objects
 */
async function getUserNotifications(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      includeRead = true,
      subscriptionId = null
    } = options;
    
    // Set RLS context for security
    await setRLSContext(userId);
    
    let sqlQuery = `
      SELECT 
        n.id,
        n.user_id,
        n.title,
        n.content,
        n.source_url,
        n.read,
        n.created_at,
        n.read_at,
        n.subscription_id,
        n.entity_type,
        n.source,
        n.data,
        n.metadata,
        s.name as subscription_name,
        s.type_id
      FROM notifications n
      LEFT JOIN subscriptions s ON n.subscription_id = s.id
      WHERE n.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    // Add filter for unread notifications if needed
    if (!includeRead) {
      sqlQuery += ` AND n.read = false`;
    }
    
    // Add filter for subscription if provided
    if (subscriptionId) {
      sqlQuery += ` AND n.subscription_id = $${paramIndex}`;
      queryParams.push(subscriptionId);
      paramIndex++;
    }
    
    // Add order by most recent first
    sqlQuery += ` ORDER BY n.created_at DESC`;
    
    // Add pagination
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const result = await query(sqlQuery, queryParams);
    
    // Process returned rows to format content and handle metadata
    return result.rows.map(row => {
      // Parse content if it's a JSON string
      let parsedContent = row.content;
      try {
        if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
          parsedContent = JSON.parse(row.content);
        }
        // Not JSON, keep as plain text
      } catch (e) {
        // If parsing fails, keep the original content as a string
        console.warn('Error parsing notification content', e);
        parsedContent = row.content;
      }
      
      // Parse metadata if it's a JSON string
      let metadata = row.metadata;
      try {
        if (typeof row.metadata === 'string' && row.metadata.trim()) {
          metadata = JSON.parse(row.metadata);
        }
      } catch (e) {
        // If parsing fails, use an empty object
        console.warn('Error parsing notification metadata', e);
        metadata = {};
      }
      
      // Parse data if it's a JSON string
      let data = row.data;
      try {
        if (typeof row.data === 'string' && row.data.trim()) {
          data = JSON.parse(row.data);
        }
      } catch (e) {
        // If parsing fails, use an empty object
        console.warn('Error parsing notification data', e);
        data = {};
      }
      
      // Return a fully formed notification object, preserving all fields
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title || '',
        content: parsedContent || '',
        sourceUrl: row.source_url || '',
        read: !!row.read,
        createdAt: row.created_at,
        readAt: row.read_at,
        subscriptionId: row.subscription_id,
        subscriptionName: row.subscription_name || '',
        entityType: row.entity_type || 'notification:generic',
        source: row.source || '',
        data: data || {},
        metadata: metadata || {}
      };
    });
  } catch (error) {
    logger.error('Error fetching user notifications', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      options 
    });
    throw error;
  }
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    const sqlQuery = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error marking notification as read', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user ID
 * @param {string} [subscriptionId] - Optional subscription ID to filter by
 * @returns {Promise<number>} - Number of notifications marked as read
 */
async function markAllNotificationsAsRead(userId, subscriptionId = null) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    let sqlQuery = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE user_id = $1 AND read = false
    `;
    
    const queryParams = [userId];
    
    // Add filter for subscription if provided
    if (subscriptionId) {
      sqlQuery += ` AND subscription_id = $2`;
      queryParams.push(subscriptionId);
    }
    
    sqlQuery += ` RETURNING id`;
    
    const result = await query(sqlQuery, queryParams);
    
    return result.rows.length;
  } catch (error) {
    logger.error('Error marking all notifications as read', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      subscriptionId 
    });
    throw error;
  }
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteNotification(notificationId, userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    const sqlQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error deleting notification', { 
      error: error.message, 
      stack: error.stack,
      notificationId, 
      userId 
    });
    throw error;
  }
}

/**
 * Delete all notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<number>} - Number of notifications deleted
 */
async function deleteAllNotifications(userId, options = {}) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    let sqlQuery = `
      DELETE FROM notifications
      WHERE user_id = $1
    `;
    
    const queryParams = [userId];
    
    // Add filter for subscription if provided
    if (options.subscriptionId) {
      sqlQuery += ` AND subscription_id = $2`;
      queryParams.push(options.subscriptionId);
    }
    
    sqlQuery += ` RETURNING id`;
    
    const result = await query(sqlQuery, queryParams);
    
    return result.rows.length;
  } catch (error) {
    logger.error('Error deleting all notifications', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      options 
    });
    throw error;
  }
}

/**
 * Count unread notifications for a user
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Count of unread notifications
 */
async function countUnreadNotifications(userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    const sqlQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read = false
    `;
    
    const result = await query(sqlQuery, [userId]);
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error('Error counting unread notifications', { 
      error: error.message, 
      stack: error.stack,
      userId 
    });
    throw error;
  }
}

/**
 * Get notification statistics for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Statistics object with counts and breakdowns
 */
async function getNotificationStats(userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    // Get total count
    const totalQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
    `;
    
    const totalResult = await query(totalQuery, [userId]);
    const total = parseInt(totalResult.rows[0].count);
    
    // Get unread count
    const unreadQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read = false
    `;
    
    const unreadResult = await query(unreadQuery, [userId]);
    const unread = parseInt(unreadResult.rows[0].count);
    
    // Get counts by type
    const byTypeQuery = `
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
      GROUP BY entity_type
      ORDER BY count DESC
    `;
    
    const byTypeResult = await query(byTypeQuery, [userId]);
    
    const byType = {};
    byTypeResult.rows.forEach(row => {
      byType[row.entity_type] = parseInt(row.count);
    });
    
    return {
      total,
      unread,
      byType
    };
  } catch (error) {
    logger.error('Error getting notification stats', { 
      error: error.message, 
      stack: error.stack,
      userId 
    });
    throw error;
  }
}

/**
 * Get notification activity statistics for a user
 * @param {string} userId - The user ID
 * @param {number} [days=7] - Number of days to include in the statistics
 * @returns {Promise<Object>} - Activity statistics
 */
async function getActivityStats(userId, days = 7) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    // Get activity by day
    const activityByDayQuery = `
      SELECT 
        TO_CHAR(created_at, 'Dy') as day,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY MIN(created_at)
    `;
    
    const activityByDayResult = await query(activityByDayQuery, [userId]);
    
    const activityByDay = activityByDayResult.rows.map(row => ({
      day: row.day,
      count: parseInt(row.count)
    }));
    
    // Get sources
    const sourcesQuery = `
      SELECT 
        COALESCE(
          CASE 
            WHEN metadata ? 'source' THEN metadata->>'source'
            WHEN metadata ? 'type' THEN metadata->>'type' 
            ELSE COALESCE(source, entity_type)
          END, 
          'generic'
        ) as name,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY name
      ORDER BY count DESC
    `;
    
    const sourcesResult = await query(sourcesQuery, [userId]);
    
    // Source colors (could be moved to a configuration)
    const sourceColors = {
      'BOE': '#4f46e5',
      'DOGA': '#0ea5e9',
      'REAL_ESTATE': '#10b981'
    };
    
    const sources = sourcesResult.rows.map(row => ({
      name: row.name,
      count: parseInt(row.count),
      color: sourceColors[row.name.toUpperCase()] || '#6b7280'
    }));
    
    return {
      activityByDay,
      sources
    };
  } catch (error) {
    logger.error('Error getting activity stats', { 
      error: error.message, 
      stack: error.stack,
      userId,
      days
    });
    throw error;
  }
}

/**
 * Get user email preferences for notifications
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} - User email preferences
 */
async function getUserEmailPreferences(userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    const sqlQuery = `
      SELECT 
        email,
        metadata
      FROM users
      WHERE id = $1
    `;
    
    const result = await query(sqlQuery, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    const metadata = user.metadata || {};
    
    // Extract email preferences from metadata JSONB
    return {
      email: user.email,
      email_notifications: metadata?.notifications?.email?.enabled !== false, // Default to true
      notification_email: metadata?.notifications?.email?.useCustomEmail ? 
        metadata?.notifications?.email?.customEmail : null
    };
  } catch (error) {
    // Safe logging that works with different logger interfaces
    if (typeof logger.error === 'function') {
      logger.error('Error getting user email preferences', { 
        error: error.message, 
        stack: error.stack,
        userId 
      });
    } else if (typeof logger.logError === 'function') {
      logger.logError({ userId }, 'Error getting user email preferences', { 
        error: error.message, 
        stack: error.stack
      });
    } else {
      console.error('Error getting user email preferences', { 
        error: error.message, 
        stack: error.stack,
        userId 
      });
    }
    throw error;
  }
}

/**
 * Get a notification by ID
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} - Notification object or null if not found
 */
async function getNotificationById(notificationId, userId) {
  try {
    // Set RLS context for security
    await setRLSContext(userId);
    
    const sqlQuery = `
      SELECT 
        n.id,
        n.user_id,
        n.title,
        n.content,
        n.source_url,
        n.read,
        n.created_at,
        n.read_at,
        n.subscription_id,
        n.entity_type,
        n.source,
        n.data,
        n.metadata,
        s.name as subscription_name,
        s.type_id
      FROM notifications n
      LEFT JOIN subscriptions s ON n.subscription_id = s.id
      WHERE n.id = $1 AND n.user_id = $2
    `;
    
    const result = await query(sqlQuery, [notificationId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    // Parse content if it's a JSON string
    let parsedContent = row.content;
    try {
      if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
        parsedContent = JSON.parse(row.content);
      }
      // Not JSON, keep as plain text
    } catch (e) {
      // If parsing fails, keep the original content as a string
      console.warn('Error parsing notification content', e);
      parsedContent = row.content;
    }
    
    // Parse metadata if it's a JSON string
    let metadata = row.metadata;
    try {
      if (typeof row.metadata === 'string' && row.metadata.trim()) {
        metadata = JSON.parse(row.metadata);
      }
    } catch (e) {
      // If parsing fails, use an empty object
      console.warn('Error parsing notification metadata', e);
      metadata = {};
    }
    
    // Parse data if it's a JSON string
    let data = row.data;
    try {
      if (typeof row.data === 'string' && row.data.trim()) {
        data = JSON.parse(row.data);
      }
    } catch (e) {
      // If parsing fails, use an empty object
      console.warn('Error parsing notification data', e);
      data = {};
    }
    
    // Return a fully formed notification object, preserving all fields
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title || '',
      content: parsedContent || '',
      sourceUrl: row.source_url || '',
      read: !!row.read,
      createdAt: row.created_at,
      readAt: row.read_at,
      subscriptionId: row.subscription_id,
      subscriptionName: row.subscription_name || '',
      entityType: row.entity_type || 'notification:generic',
      source: row.source || '',
      data: data || {},
      metadata: metadata || {}
    };
  } catch (error) {
    logger.error('Error getting notification by ID', { 
      error: error.message, 
      stack: error.stack,
      notificationId,
      userId
    });
    throw error;
  }
}

// Export implementation that matches the interface
export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  countUnreadNotifications,
  getNotificationStats,
  getActivityStats,
  getUserEmailPreferences,
  getNotificationById
}; 