// src/infrastructure/database/notification.repository.js
import db from './client.js'; // Assuming db client setup exports a query function
import logger from '../../shared/logging/logger.js'; // Assuming logger path

/**
 * Creates a notification record in the database.
 * @param {object} notificationData - Notification data (userId, type, content, read, createdAt)
 * @returns {Promise<number>} The ID of the inserted notification.
 */
export async function createNotificationRecord(notificationData) {
  const { userId, type, content, read, createdAt } = notificationData;
  const query = 'INSERT INTO notifications (user_id, type, content, read, created_at) VALUES (?, ?, ?, ?, ?)';
  const params = [userId, type, content, read, createdAt];
  try {
    const result = await db.query(query, params);
    // Assuming result structure provides insertId or equivalent
    const insertId = result.insertId || result[0]?.insertId;
    if (insertId == null) {
        throw new Error('Database did not return an insert ID for notification.');
    }
    logger.debug('Notification record created in DB', { notificationId: insertId, userId });
    return insertId;
  } catch (error) {
    logger.error('Error creating notification record in DB', { error: error.message, userId, type });
    throw error; // Re-throw to be handled by the service layer
  }
}

/**
 * Retrieves notifications for a user with optional filters.
 * @param {string} userId - The user ID.
 * @param {object} options - Filtering and pagination options.
 * @param {number} options.limit
 * @param {number} options.offset
 * @param {boolean} options.includeRead
 * @param {string|null} options.subscriptionId
 * @returns {Promise<Array<object>>} List of raw notification records from DB.
 */
export async function findUserNotifications(userId, options) {
  const { limit = 20, offset = 0, includeRead = false, subscriptionId = null } = options;
  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const queryParams = [userId];

  if (!includeRead) {
    query += ' AND read = FALSE';
  }

  if (subscriptionId) {
    // Note: JSON_EXTRACT might have performance implications on large tables without indexing
    query += ' AND (JSON_EXTRACT(content, "$.subscriptionId") = ? OR JSON_EXTRACT(content, "$.subscription_id") = ?)';
    queryParams.push(subscriptionId, subscriptionId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  try {
    const notifications = await db.query(query, queryParams);
    // Assuming query returns an array of rows
    logger.debug('Retrieved notifications from DB', { userId, count: notifications.length, options });
    return notifications || [];
  } catch (error) {
    logger.error('Error fetching user notifications from DB', { error: error.message, userId, options });
    throw error;
  }
}

/**
 * Marks a specific notification as read for a user.
 * @param {number|string} notificationId - The ID of the notification.
 * @param {string} userId - The user ID.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export async function markNotificationRead(notificationId, userId) {
  const query = 'UPDATE notifications SET read = TRUE WHERE id = ? AND user_id = ?';
  const params = [notificationId, userId];
  try {
    const result = await db.query(query, params);
    // Check affectedRows or equivalent property from the DB driver
    const updated = (result.affectedRows || result[0]?.affectedRows || 0) > 0;
    logger.debug('Marked notification as read in DB', { notificationId, userId, updated });
    return updated;
  } catch (error) {
    logger.error('Error marking notification read in DB', { error: error.message, notificationId, userId });
    throw error;
  }
}

/**
 * Deletes a specific notification for a user, checking ownership.
 * @param {number|string} notificationId - The ID of the notification.
 * @param {string} userId - The user ID.
 * @returns {Promise<boolean>} True if deleted or did not exist, false on ownership mismatch.
 */
export async function deleteNotificationById(notificationId, userId) {
  const deleteQuery = 'DELETE FROM notifications WHERE id = ? AND user_id = ?';
  const checkQuery = 'SELECT 1 FROM notifications WHERE id = ?';
  try {
    // Attempt deletion with ownership check
    const deleteResult = await db.query(deleteQuery, [notificationId, userId]);
    const deleted = (deleteResult.affectedRows || deleteResult[0]?.affectedRows || 0) > 0;

    if (deleted) {
      logger.debug('Notification deleted from DB', { notificationId, userId });
      return true;
    }

    // If not deleted, check if it exists at all
    const existsResult = await db.query(checkQuery, [notificationId]);
    if (!existsResult || existsResult.length === 0) {
      logger.debug('Notification not found in DB for deletion', { notificationId, userId });
      return true; // Treat non-existent as successfully deleted
    }

    // Exists but user ID didn't match
    logger.warn('Failed to delete notification - ownership mismatch', { notificationId, userId });
    return false;

  } catch (error) {
    logger.error('Error deleting notification from DB', { error: error.message, notificationId, userId });
    throw error;
  }
}

/**
 * Deletes all notifications for a user, optionally filtered by subscription ID.
 * @param {string} userId - The user ID.
 * @param {object} options - Filtering options.
 * @param {string|null} options.subscriptionId
 * @returns {Promise<number>} The number of deleted notifications.
 */
export async function deleteAllUserNotifications(userId, options = {}) {
  const { subscriptionId = null } = options;
  let query = 'DELETE FROM notifications WHERE user_id = ?';
  const params = [userId];

  if (subscriptionId) {
    query += ' AND (JSON_EXTRACT(content, "$.subscriptionId") = ? OR JSON_EXTRACT(content, "$.subscription_id") = ?)';
    params.push(subscriptionId, subscriptionId);
  }

  try {
    const result = await db.query(query, params);
    const deletedCount = result.affectedRows || result[0]?.affectedRows || 0;
    logger.debug('Deleted all user notifications from DB', { userId, subscriptionId, deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting all user notifications from DB', { error: error.message, userId, subscriptionId });
    throw error;
  }
}

/**
 * Counts unread notifications for a user.
 * @param {string} userId - The user ID.
 * @returns {Promise<number>} The count of unread notifications.
 */
export async function countUnreadUserNotifications(userId) {
  const query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = FALSE';
  const params = [userId];
  try {
    const result = await db.query(query, params);
    // Ensure result and count exist
    const count = result?.[0]?.count ?? 0;
    logger.debug('Counted unread notifications from DB', { userId, count });
    return count;
  } catch (error) {
    logger.error('Error counting unread notifications from DB', { error: error.message, userId });
    throw error; // Let service decide fallback value (e.g., 0)
  }
}

/**
 * Retrieves user email preferences from the users table.
 * Needed by notification service to decide whether to trigger email notification.
 * @param {string} userId - The user ID.
 * @returns {Promise<object|null>} User email preference data or null if user not found.
 */
export async function findUserEmailPreferences(userId) {
    const query = 'SELECT email FROM users WHERE id = ?';
    try {
        const result = await db.query(query, [userId]);
        if (result && result.length > 0) {
            logger.debug('Found user email preferences', { userId });
            // Add default preferences since we don't store these columns
            return {
                ...result[0],
                email_notifications: true, // Default to true so notifications work
                notification_email: null   // Default to null, will fall back to primary email
            };
        }
        logger.warn('User not found when fetching email preferences', { userId });
        return null;
    } catch (error) {
        logger.error('Error fetching user email preferences from DB', { error: error.message, userId });
        throw error;
    }
} 