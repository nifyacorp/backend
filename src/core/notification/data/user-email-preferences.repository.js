import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logError } from '../../../shared/logging/logger.js';

/**
 * Repository for handling user email notification preferences
 */
export class UserEmailPreferencesRepository {
  /**
   * Get email notification preferences for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Email preferences
   */
  async getEmailPreferences(userId) {
    try {
      // First try the new schema structure with notification_settings JSONB column
      try {
        const result = await query(
          `SELECT 
            notification_settings
          FROM users
          WHERE id = $1`,
          [userId]
        );
        
        if (result.rows.length === 0) {
          return {
            email_notifications: false,
            notification_email: null,
            digest_time: '08:00:00'
          };
        }
        
        // Extract values from JSONB notification_settings
        const settings = result.rows[0].notification_settings || {};
        
        return {
          email_notifications: settings.emailNotifications !== undefined ? settings.emailNotifications : true,
          notification_email: settings.notificationEmail || null,
          digest_time: '08:00:00' // Default time
        };
        
      } catch (schemaError) {
        // If notification_settings doesn't exist, fall back to the old schema
        console.log('Falling back to legacy email preferences schema:', schemaError.message);
        
        // Try the old schema columns instead
        const fallbackResult = await query(
          `SELECT 
            email_notifications, 
            notification_email, 
            digest_time
          FROM users
          WHERE id = $1`,
          [userId]
        );
        
        if (fallbackResult.rows.length === 0) {
          return {
            email_notifications: false,
            notification_email: null,
            digest_time: '08:00:00'
          };
        }
        
        return fallbackResult.rows[0];
      }
    } catch (error) {
      logError({ source: 'UserEmailPreferencesRepository', method: 'getEmailPreferences' }, error);
      
      // Return defaults if all else fails
      return {
        email_notifications: true,
        notification_email: null,
        digest_time: '08:00:00'
      };
    }
  }
  
  /**
   * Update email notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} preferences - Email preferences to update
   * @returns {Promise<Object>} Updated preferences
   */
  async updateEmailPreferences(userId, preferences) {
    try {
      // Try to update using the new JSONB notification_settings column first
      try {
        // Get the current settings to merge with updates
        const currentSettings = await query(
          `SELECT notification_settings FROM users WHERE id = $1`,
          [userId]
        );
        
        if (currentSettings.rows.length === 0) {
          throw new AppError(
            'NOT_FOUND',
            'User not found',
            404
          );
        }
        
        // Get existing settings or initialize empty object
        const existingSettings = currentSettings.rows[0].notification_settings || {};
        
        // Create the updated settings object
        const updatedSettings = { ...existingSettings };
        
        if (preferences.email_notifications !== undefined) {
          updatedSettings.emailNotifications = preferences.email_notifications;
        }
        
        if (preferences.notification_email !== undefined) {
          updatedSettings.notificationEmail = preferences.notification_email;
        }
        
        if (preferences.digest_time !== undefined) {
          updatedSettings.digestTime = preferences.digest_time;
        }
        
        // Update the notification_settings JSONB column
        const result = await query(
          `UPDATE users 
           SET notification_settings = $2
           WHERE id = $1
           RETURNING notification_settings`,
          [userId, updatedSettings]
        );
        
        // Format the response to match the expected format
        const settings = result.rows[0].notification_settings;
        return {
          email_notifications: settings.emailNotifications !== undefined ? settings.emailNotifications : true,
          notification_email: settings.notificationEmail || null,
          digest_time: settings.digestTime || '08:00:00'
        };
        
      } catch (schemaError) {
        // If notification_settings doesn't exist, fall back to the old schema
        console.log('Falling back to legacy schema for updateEmailPreferences:', schemaError.message);
        
        // Build the update query with only the specified fields
        const fields = [];
        const values = [];
        let paramCounter = 2; // Start at 2 because userId is param 1
        
        if (preferences.email_notifications !== undefined) {
          fields.push(`email_notifications = $${paramCounter++}`);
          values.push(preferences.email_notifications);
        }
        
        if (preferences.notification_email !== undefined) {
          fields.push(`notification_email = $${paramCounter++}`);
          values.push(preferences.notification_email);
        }
        
        if (preferences.digest_time !== undefined) {
          fields.push(`digest_time = $${paramCounter++}`);
          values.push(preferences.digest_time);
        }
        
        if (fields.length === 0) {
          // No fields to update
          const currentPrefs = await this.getEmailPreferences(userId);
          return currentPrefs;
        }
        
        const result = await query(
          `UPDATE users 
          SET ${fields.join(', ')} 
          WHERE id = $1
          RETURNING email_notifications, notification_email, digest_time`,
          [userId, ...values]
        );
        
        if (result.rows.length === 0) {
          throw new AppError(
            'NOT_FOUND',
            'User not found',
            404
          );
        }
        
        return result.rows[0];
      }
    } catch (error) {
      logError({ source: 'UserEmailPreferencesRepository', method: 'updateEmailPreferences' }, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'DATABASE_ERROR',
        'Failed to update email preferences',
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Get users with email notifications enabled
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Users with email notifications enabled
   */
  async getUsersWithEmailNotificationsEnabled(options = {}) {
    try {
      const { limit = 100, offset = 0 } = options;
      
      // Try using the JSONB column first
      try {
        const result = await query(
          `SELECT 
            id, 
            email, 
            notification_settings->>'notificationEmail' as notification_email,
            COALESCE(notification_settings->>'digestTime', '08:00:00') as digest_time
          FROM users
          WHERE 
            (notification_settings->>'emailNotifications')::boolean = TRUE
            OR (notification_settings IS NULL AND email_notifications = TRUE)
          ORDER BY id
          LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        
        return result.rows;
      } catch (schemaError) {
        // Fall back to the old schema columns
        console.log('Falling back to legacy schema for getUsersWithEmailNotificationsEnabled:', schemaError.message);
        
        const fallbackResult = await query(
          `SELECT 
            id, 
            email, 
            notification_email, 
            digest_time
          FROM users
          WHERE email_notifications = TRUE
          ORDER BY id
          LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        
        return fallbackResult.rows;
      }
    } catch (error) {
      logError({ source: 'UserEmailPreferencesRepository', method: 'getUsersWithEmailNotificationsEnabled' }, error);
      throw new AppError(
        'DATABASE_ERROR',
        'Failed to retrieve users with email notifications enabled',
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Get user's unprocessed notifications for email
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Unprocessed notifications
   */
  async getUserUnprocessedNotifications(userId, options = {}) {
    try {
      const { limit = 100, includeRead = false } = options;
      
      // Check if email_sent column exists using try-catch approach
      try {
        let sqlQuery = `
          SELECT 
            n.id, 
            n.type, 
            n.content, 
            n.user_id, 
            n.created_at,
            n.read,
            s.name as subscription_name
          FROM notifications n
          LEFT JOIN subscriptions s ON (n.content->>'subscriptionId') = s.id::text
          WHERE n.user_id = $1 
          AND n.email_sent = FALSE
        `;
        
        const queryParams = [userId];
        
        if (!includeRead) {
          sqlQuery += ' AND n.read = FALSE';
        }
        
        sqlQuery += ' ORDER BY n.created_at DESC LIMIT $2';
        queryParams.push(limit);
        
        const result = await query(sqlQuery, queryParams);
        
        return result.rows.map(notification => ({
          ...notification,
          content: typeof notification.content === 'string' 
            ? JSON.parse(notification.content) 
            : notification.content
        }));
      } catch (schemaError) {
        // If email_sent column doesn't exist, use alternative query
        // that doesn't filter by email_sent
        console.log('Falling back to legacy schema for getUserUnprocessedNotifications:', schemaError.message);
        
        let fallbackSql = `
          SELECT 
            n.id, 
            n.type, 
            n.content, 
            n.user_id, 
            n.created_at,
            n.read,
            s.name as subscription_name
          FROM notifications n
          LEFT JOIN subscriptions s ON (n.content->>'subscriptionId') = s.id::text
          WHERE n.user_id = $1
        `;
        
        const fallbackParams = [userId];
        
        if (!includeRead) {
          fallbackSql += ' AND n.read = FALSE';
        }
        
        fallbackSql += ' ORDER BY n.created_at DESC LIMIT $2';
        fallbackParams.push(limit);
        
        const fallbackResult = await query(fallbackSql, fallbackParams);
        
        return fallbackResult.rows.map(notification => ({
          ...notification,
          content: typeof notification.content === 'string' 
            ? JSON.parse(notification.content) 
            : notification.content
        }));
      }
    } catch (error) {
      logError({ source: 'UserEmailPreferencesRepository', method: 'getUserUnprocessedNotifications' }, error);
      throw new AppError(
        'DATABASE_ERROR',
        'Failed to retrieve unprocessed notifications',
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Mark notifications as sent via email
   * @param {Array<string>} notificationIds - Array of notification IDs
   * @param {string} timestamp - Timestamp when notifications were sent
   * @returns {Promise<number>} Number of notifications marked as sent
   */
  async markNotificationsAsSent(notificationIds, timestamp = new Date().toISOString()) {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        return 0;
      }
      
      const result = await query(
        `UPDATE notifications
        SET email_sent = TRUE, email_sent_at = $1
        WHERE id = ANY($2)
        RETURNING id`,
        [timestamp, notificationIds]
      );
      
      return result.rowCount;
    } catch (error) {
      logError({ source: 'UserEmailPreferencesRepository', method: 'markNotificationsAsSent' }, error);
      throw new AppError(
        'DATABASE_ERROR',
        'Failed to mark notifications as sent',
        500,
        { originalError: error.message }
      );
    }
  }
}

export const userEmailPreferencesRepository = new UserEmailPreferencesRepository();