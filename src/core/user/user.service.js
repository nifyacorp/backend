import { query } from '../../infrastructure/database/client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { USER_ERRORS, USER_PREFERENCES } from '../types/user.types.js';
import { logRequest, logError } from '../../shared/logging/logger.js';
import { uploadProfilePicture, deleteProfilePicture } from '../../infrastructure/storage/index.js';

class UserService {
  async getUserProfile(userId, context) {
    logRequest(context, 'Fetching user profile', { userId });

    try {
      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.display_name as name,
          u.first_name,
          u.last_name,
          u.avatar_url as avatar,
          u.metadata,
          u.updated_at as "lastLogin",
          true as "emailVerified", -- Assuming email is verified via Firebase elsewhere
          (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id) as "subscriptionCount",
          (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id) as "notificationCount",
          (SELECT created_at 
           FROM notifications 
           WHERE user_id = u.id 
           ORDER BY created_at DESC 
           LIMIT 1) as "lastNotification"
        FROM users u
        WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Optionally create user if not found, or throw error
        // For now, assume user exists via sync
        throw new AppError(
          USER_ERRORS.NOT_FOUND.code,
          USER_ERRORS.NOT_FOUND.message,
          404
        );
      }

      const userData = result.rows[0];
      let metadata = userData.metadata || {};

      // Ensure default metadata structure exists if it's empty
      if (!metadata.profile || !metadata.preferences || !metadata.notifications || !metadata.security) {
        const defaultMetadata = {
          profile: { bio: "", interests: [] },
          preferences: { language: "es", theme: "light" },
          notifications: { 
            email: { 
              enabled: true, 
              useCustomEmail: false, 
              customEmail: null, 
              digestTime: "08:00",
              frequency: "daily"
            },
            instantNotifications: true
          },
          security: { lastPasswordChange: null, lastLogoutAllDevices: null }
        };

        // Update the database and use the default for the current response
        await query(
          `UPDATE users SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(defaultMetadata), userId]
        );
        metadata = defaultMetadata;
      }

      // Construct the final profile object from userData and metadata
      const profile = {
        id: userData.id,
        email: userData.email,
        name: userData.name, // display_name
        first_name: userData.first_name,
        last_name: userData.last_name,
        avatar: userData.avatar, // avatar_url
        bio: metadata.profile?.bio,
        theme: metadata.preferences?.theme,
        language: metadata.preferences?.language,
        notification_settings: {
          emailNotifications: metadata.notifications?.email?.enabled,
          notificationEmail: metadata.notifications?.email?.customEmail,
          useCustomEmail: metadata.notifications?.email?.useCustomEmail,
          emailFrequency: metadata.notifications?.email?.frequency || 'daily',
          instantNotifications: metadata.notifications?.instantNotifications || false,
          digestTime: metadata.notifications?.email?.digestTime
        },
        lastLogin: userData.lastLogin,
        emailVerified: userData.emailVerified,
        subscriptionCount: parseInt(userData.subscriptionCount || '0', 10),
        notificationCount: parseInt(userData.notificationCount || '0', 10),
        lastNotification: userData.lastNotification,
      };

      logRequest(context, 'User profile retrieved successfully', { userId });
      return profile;
    } catch (error) {
      logError(context, error, { userId });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        USER_ERRORS.FETCH_ERROR.code,
        USER_ERRORS.FETCH_ERROR.message,
        500,
        { originalError: error.message }
      );
    }
  }

  async updateUserProfile(userId, updates, context) {
    logRequest(context, 'Updating user profile and settings', { 
      userId,
      updateFields: Object.keys(updates)
    });

    const directUpdates = {};
    const metadataPaths = [];
    const metadataValues = [];

    // --- Separate direct column updates from metadata updates --- 
    if (updates.name !== undefined) directUpdates.display_name = updates.name;
    if (updates.first_name !== undefined) directUpdates.first_name = updates.first_name;
    if (updates.last_name !== undefined) directUpdates.last_name = updates.last_name;
    if (updates.avatar !== undefined) directUpdates.avatar_url = updates.avatar;

    // --- Handle simple metadata fields --- 
    if (updates.bio !== undefined) {
      metadataPaths.push(`'{profile,bio}'`);
      metadataValues.push(updates.bio);
    }
    if (updates.theme !== undefined) {
      if (!USER_PREFERENCES.THEMES.includes(updates.theme)) {
         throw new AppError(USER_ERRORS.INVALID_THEME.code, USER_ERRORS.INVALID_THEME.message, 400);
      }
      metadataPaths.push(`'{preferences,theme}'`);
      metadataValues.push(updates.theme);
    }
    if (updates.language !== undefined) {
       if (!USER_PREFERENCES.LANGUAGES.includes(updates.language)) {
         throw new AppError(USER_ERRORS.INVALID_LANGUAGE.code, USER_ERRORS.INVALID_LANGUAGE.message, 400);
       }
       metadataPaths.push(`'{preferences,language}'`);
       metadataValues.push(updates.language);
    }

    // --- Handle nested notification settings --- 
    if (updates.notification_settings) {
      const ns = updates.notification_settings;
      
      // Basic validation
      if (ns.emailNotifications !== undefined && typeof ns.emailNotifications !== 'boolean') {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'emailNotifications must be a boolean', 400);
      }
      
      if (ns.useCustomEmail !== undefined && typeof ns.useCustomEmail !== 'boolean') {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'useCustomEmail must be a boolean', 400);
      }
      
      if (ns.notificationEmail !== undefined && ns.notificationEmail !== null && 
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ns.notificationEmail)) {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'notificationEmail must be a valid email address', 400);
      }
      
      if (ns.emailFrequency !== undefined && !['daily', 'weekly', 'immediate'].includes(ns.emailFrequency)) {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'emailFrequency must be daily, weekly, or immediate', 400);
      }
      
      if (ns.instantNotifications !== undefined && typeof ns.instantNotifications !== 'boolean') {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'instantNotifications must be a boolean', 400);
      }
      
      if (ns.digestTime !== undefined && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(ns.digestTime)) {
        throw new AppError('INVALID_NOTIFICATION_SETTING', 'digestTime must be in format HH:MM', 400);
      }
      
      if (ns.emailNotifications !== undefined) {
        metadataPaths.push(`'{notifications,email,enabled}'`);
        metadataValues.push(ns.emailNotifications);
      }
      if (ns.notificationEmail !== undefined) {
        metadataPaths.push(`'{notifications,email,customEmail}'`);
        metadataValues.push(ns.notificationEmail);
      }
      if (ns.useCustomEmail !== undefined) {
        metadataPaths.push(`'{notifications,email,useCustomEmail}'`);
        metadataValues.push(ns.useCustomEmail);
      }
      if (ns.digestTime !== undefined) {
        metadataPaths.push(`'{notifications,email,digestTime}'`);
        metadataValues.push(ns.digestTime);
      }
      if (ns.emailFrequency !== undefined) {
        metadataPaths.push(`'{notifications,email,frequency}'`);
        metadataValues.push(ns.emailFrequency);
      }
      if (ns.instantNotifications !== undefined) {
        metadataPaths.push(`'{notifications,instantNotifications}'`);
        metadataValues.push(ns.instantNotifications);
      }
    }

    // --- Build and Execute SQL Query --- 
    if (Object.keys(directUpdates).length === 0 && metadataPaths.length === 0) {
      logRequest(context, 'No valid profile fields to update', { userId });
      return this.getUserProfile(userId, context); // Return current profile if no changes
    }

    try {
      let sqlQuery = 'UPDATE users SET ';
      const setClauses = [];
      const queryParams = [];
      let paramIndex = 1;

      // Add direct updates
      for (const [key, value] of Object.entries(directUpdates)) {
        setClauses.push(`${key} = $${paramIndex++}`);
        queryParams.push(value);
      }

      // Add metadata updates using jsonb_set
      if (metadataPaths.length > 0) {
        let metadataUpdateClause = 'metadata = ';
        
        // Build nested jsonb_set calls from inside out
        let nestedExpression = 'metadata';
        for (let i = 0; i < metadataPaths.length; i++) {
          nestedExpression = `jsonb_set(${nestedExpression}, ${metadataPaths[i]}, $${paramIndex}::jsonb, true)`;
          queryParams.push(JSON.stringify(metadataValues[i]));
          paramIndex++;
        }
        
        setClauses.push(metadataUpdateClause + nestedExpression);
      }
      
      // Always update the updated_at timestamp
      setClauses.push(`updated_at = NOW()`);

      sqlQuery += setClauses.join(', ');
      sqlQuery += ` WHERE id = $${paramIndex}`; // Add user ID at the end
      queryParams.push(userId);

      // Execute the query
      await query(sqlQuery, queryParams);

      logRequest(context, 'User profile and settings updated successfully', { userId });

      // Return the updated profile
      return this.getUserProfile(userId, context);
    } catch (error) {
      logError(context, error, { userId });
      throw new AppError(
        USER_ERRORS.UPDATE_ERROR.code,
        USER_ERRORS.UPDATE_ERROR.message,
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Upload a profile picture for a user
   * 
   * @param {string} userId - The user ID
   * @param {Buffer} fileBuffer - The profile picture file buffer
   * @param {string} fileName - Original file name
   * @param {string} contentType - The file content type
   * @param {Object} context - Request context for logging
   * @returns {Promise<Object>} - Updated user profile
   */
  async uploadProfilePicture(userId, fileBuffer, fileName, contentType, context) {
    logRequest(context, 'Uploading profile picture', { userId, fileName, contentType });

    try {
      // Upload the file to Google Cloud Storage
      const pictureUrl = await uploadProfilePicture(fileBuffer, fileName, userId, contentType);
      
      // Update the user's avatar URL in the database
      await query(
        `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
        [pictureUrl, userId]
      );
      
      logRequest(context, 'Profile picture uploaded and user updated', { 
        userId, 
        pictureUrl 
      });
      
      // Return the updated user profile
      return this.getUserProfile(userId, context);
    } catch (error) {
      logError(context, error, { userId, fileName });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        USER_ERRORS.PROFILE_PICTURE_ERROR.code || 'PROFILE_PICTURE_ERROR',
        error.message || USER_ERRORS.PROFILE_PICTURE_ERROR.message || 'Failed to upload profile picture',
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Delete a user's profile picture
   * 
   * @param {string} userId - The user ID
   * @param {Object} context - Request context for logging
   * @returns {Promise<Object>} - Updated user profile
   */
  async deleteProfilePicture(userId, context) {
    logRequest(context, 'Deleting profile picture', { userId });

    try {
      // Delete the file from Google Cloud Storage
      await deleteProfilePicture(userId);
      
      // Clear the user's avatar URL in the database
      await query(
        `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      
      logRequest(context, 'Profile picture deleted and user updated', { userId });
      
      // Return the updated user profile
      return this.getUserProfile(userId, context);
    } catch (error) {
      logError(context, error, { userId });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        USER_ERRORS.PROFILE_PICTURE_ERROR.code || 'PROFILE_PICTURE_ERROR',
        error.message || USER_ERRORS.PROFILE_PICTURE_ERROR.message || 'Failed to delete profile picture',
        500,
        { originalError: error.message }
      );
    }
  }
}

export const userService = new UserService();