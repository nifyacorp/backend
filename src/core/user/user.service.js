import { query } from '../../infrastructure/database/client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { USER_ERRORS, USER_PREFERENCES } from '../types/user.types.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

class UserService {
  async getUserProfile(userId, context) {
    logRequest(context, 'Fetching user profile', { userId });

    try {
      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.display_name as name,
          u.metadata->>'avatar' as avatar,
          u.metadata->>'bio' as bio,
          u.metadata->'preferences'->>'theme' as theme,
          u.metadata->'preferences'->>'language' as language,
          u.metadata->'notifications' as notification_settings,
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

      const profileData = result.rows[0];
      
      // Ensure notification_settings is an object, providing defaults if null/missing
      const defaultNotificationSettings = {
        emailNotifications: true,
        notificationEmail: profileData.email, // Default to user's main email
        emailFrequency: 'daily',
        instantNotifications: false,
        digestTime: '08:00:00' 
      };
      
      const notificationSettings = {
         ...defaultNotificationSettings,
        ...(profileData.notification_settings || {}), // Merge with defaults
      };

      // Construct the final profile object
      const profile = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        avatar: profileData.avatar,
        bio: profileData.bio,
        theme: profileData.theme || 'system', // Default theme
        language: profileData.language || 'es', // Default language
        notification_settings: notificationSettings,
        lastLogin: profileData.lastLogin,
        emailVerified: profileData.emailVerified,
        subscriptionCount: parseInt(profileData.subscriptionCount, 10),
        notificationCount: parseInt(profileData.notificationCount, 10),
        lastNotification: profileData.lastNotification,
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
    logRequest(context, 'Updating user profile (metadata only)', { 
      userId,
      updateFields: Object.keys(updates)
    });

    // Allow updating only specific metadata fields
    const allowedMetadataUpdates = ['name', 'bio', 'theme', 'language', 'avatar'];
    const metadataUpdates = {};
    let displayNameUpdate = null;

    for (const key of Object.keys(updates)) {
      if (allowedMetadataUpdates.includes(key)) {
        if (key === 'name') {
            displayNameUpdate = updates[key];
        } else {
            metadataUpdates[key] = updates[key];
        }
      } else {
         console.warn(`Attempted to update disallowed field '${key}' via updateUserProfile`);
      }
    }

    // Validate theme if provided
    if (metadataUpdates.theme && !USER_PREFERENCES.THEMES.includes(metadataUpdates.theme)) {
      throw new AppError(
        USER_ERRORS.INVALID_THEME.code,
        USER_ERRORS.INVALID_THEME.message,
        400,
        { allowedThemes: USER_PREFERENCES.THEMES }
      );
    }
    // Validate language if provided
    if (metadataUpdates.language && !USER_PREFERENCES.LANGUAGES.includes(metadataUpdates.language)) {
      throw new AppError(
          USER_ERRORS.INVALID_LANGUAGE.code, 
          USER_ERRORS.INVALID_LANGUAGE.message, 
          400, 
          { allowedLanguages: USER_PREFERENCES.LANGUAGES }
      );
    }

    if (Object.keys(metadataUpdates).length === 0 && !displayNameUpdate) {
      logRequest(context, 'No valid profile fields to update', { userId });
      // Return current profile if no valid updates provided
      return this.getUserProfile(userId, context);
    }

    try {
       // Build the query conditionally
      let sqlQuery = 'UPDATE users SET ';
      const queryParams = [userId];
      let paramIndex = 2;
      const setClauses = [];

      if (displayNameUpdate !== null) {
          setClauses.push(`display_name = $${paramIndex++}`);
          queryParams.push(displayNameUpdate);
      }
      
      if (Object.keys(metadataUpdates).length > 0) {
        setClauses.push(`metadata = metadata || $${paramIndex++}::jsonb`);
        queryParams.push(JSON.stringify(metadataUpdates));
      }

      sqlQuery += setClauses.join(', ') + ` WHERE id = $1`;

      await query(sqlQuery, queryParams);

      logRequest(context, 'User profile metadata updated successfully', { userId });

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

  // Keep this method as is - it should update the notification_settings JSONB
  async updateNotificationSettings(userId, settings, context) {
    logRequest(context, 'Updating notification settings', { 
      userId,
      updateFields: Object.keys(settings)
    });

    // Validate settings structure (optional, but recommended)
    // Example: Ensure emailFrequency is 'daily' if provided
    if (settings.emailFrequency && settings.emailFrequency !== 'daily') {
         throw new AppError('VALIDATION_ERROR', 'Invalid email frequency', 400);
    }

    try {
      // Merge with existing settings to only update provided fields
      const result = await query(
        `UPDATE users 
         SET notification_settings = notification_settings || $2::jsonb 
         WHERE id = $1
         RETURNING notification_settings`,
        [userId, JSON.stringify(settings)]
      );

      if (result.rows.length === 0) {
        throw new AppError(USER_ERRORS.NOT_FOUND.code, USER_ERRORS.NOT_FOUND.message, 404);
      }

      logRequest(context, 'Notification settings updated successfully', { userId });

      // Return the full updated settings object
      return result.rows[0].notification_settings;
    } catch (error) {
      logError(context, error, { userId });
      throw new AppError(
        USER_ERRORS.UPDATE_ERROR.code,
        'Failed to update notification settings',
        500,
        { originalError: error.message }
      );
    }
  }
}

export const userService = new UserService();