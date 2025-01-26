import { query } from '../../infrastructure/database/client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { USER_ERRORS } from '../types/user.types.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

class UserService {
  async getUserProfile(userId, context) {
    logRequest(context, 'Fetching user profile', { userId });

    try {
      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.name,
          u.preferences->>'avatar' as avatar,
          u.preferences->>'bio' as bio,
          u.preferences->>'theme' as theme,
          u.preferences->>'language' as language,
          u.notification_settings->>'emailNotifications' as "emailNotifications",
          u.notification_settings->>'notificationEmail' as "notificationEmail",
          u.updated_at as "lastLogin",
          true as "emailVerified",
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
        throw new AppError(
          USER_ERRORS.NOT_FOUND.code,
          USER_ERRORS.NOT_FOUND.message,
          404,
          { userId }
        );
      }

      // Convert string boolean to actual boolean
      const profile = result.rows[0];
      profile.emailNotifications = profile.emailNotifications === 'true';
      
      logRequest(context, 'User profile retrieved', {
        userId,
        hasPreferences: !!profile.preferences,
        hasNotificationSettings: !!profile.notification_settings
      });

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
    logRequest(context, 'Updating user profile', { 
      userId,
      updateFields: Object.keys(updates)
    });

    try {
      // Validate theme if provided
      if (updates.theme && !USER_PREFERENCES.THEMES.includes(updates.theme)) {
        throw new AppError(
          USER_ERRORS.INVALID_THEME.code,
          USER_ERRORS.INVALID_THEME.message,
          400,
          { allowedThemes: USER_PREFERENCES.THEMES }
        );
      }

      // Prepare preference updates
      const preferenceUpdates = {};
      if (updates.theme !== undefined) preferenceUpdates.theme = updates.theme;
      if (updates.bio !== undefined) preferenceUpdates.bio = updates.bio;
      if (updates.language !== undefined) preferenceUpdates.language = updates.language;

      // Prepare notification settings updates
      const notificationUpdates = {};
      if (updates.emailNotifications !== undefined) {
        notificationUpdates.emailNotifications = updates.emailNotifications;
      }
      if (updates.notificationEmail !== undefined) {
        notificationUpdates.notificationEmail = updates.notificationEmail;
      }

      // Validate theme if provided
      if (updates.theme && !USER_PREFERENCES.THEMES.includes(updates.theme)) {
        throw new AppError(
          USER_ERRORS.INVALID_THEME.code,
          USER_ERRORS.INVALID_THEME.message,
          400,
          { allowedThemes: USER_PREFERENCES.THEMES }
        );
      }

      // Validate language if provided
      if (updates.language && !USER_PREFERENCES.LANGUAGES.includes(updates.language)) {
        throw new AppError(
          USER_ERRORS.INVALID_LANGUAGE.code,
          USER_ERRORS.INVALID_LANGUAGE.message,
          400,
          { allowedLanguages: USER_PREFERENCES.LANGUAGES }
        );
      }

      // Prepare preference updates
      const preferenceUpdates = {};
      if (updates.bio !== undefined) preferenceUpdates.bio = updates.bio;
      if (updates.theme !== undefined) preferenceUpdates.theme = updates.theme;
      if (updates.language !== undefined) preferenceUpdates.language = updates.language;

      // Prepare notification settings updates
      const notificationUpdates = {};
      if (updates.emailNotifications !== undefined) {
        notificationUpdates.emailNotifications = updates.emailNotifications;
      }
      if (updates.notificationEmail !== undefined) {
        notificationUpdates.notificationEmail = updates.notificationEmail;
      }

      const result = await query(
        `UPDATE users 
         SET 
           name = COALESCE($1, name),
           preferences = preferences || $2::jsonb,
           notification_settings = notification_settings || $3::jsonb,
           updated_at = NOW()
         WHERE id = $4
         RETURNING 
           id,
           email,
           name,
           preferences->>'avatar' as avatar,
           preferences->>'bio' as bio,
           preferences->>'theme' as theme,
           preferences->>'language' as language,
           notification_settings->>'emailNotifications' as "emailNotifications",
           notification_settings->>'notificationEmail' as "notificationEmail",
           updated_at as "lastLogin",
           true as "emailVerified",
           (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = users.id) as "subscriptionCount",
           (SELECT COUNT(*) FROM notifications n WHERE n.user_id = users.id) as "notificationCount",
           (SELECT created_at 
            FROM notifications 
            WHERE user_id = users.id 
            ORDER BY created_at DESC 
            LIMIT 1) as "lastNotification"`,
        [
          updates.name || null,
          JSON.stringify(preferenceUpdates),
          JSON.stringify(notificationUpdates),
          userId
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(
          USER_ERRORS.NOT_FOUND.code,
          USER_ERRORS.NOT_FOUND.message,
          404,
          { userId }
        );
      }

      // Convert string boolean to actual boolean
      const profile = result.rows[0];
      profile.emailNotifications = profile.emailNotifications === 'true';

      logRequest(context, 'User profile updated', {
        userId,
        updatedFields: Object.keys(updates)
      });

      return profile;
    } catch (error) {
      logError(context, error, { userId });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        USER_ERRORS.UPDATE_ERROR.code,
        USER_ERRORS.UPDATE_ERROR.message,
        500,
        { originalError: error.message }
      );
    }
  }
}

export const userService = new UserService();