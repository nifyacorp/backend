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
          u.metadata->>'theme' as theme,
          u.metadata->>'language' as language,
          u.metadata->>'emailNotifications' as "emailNotifications",
          u.metadata->>'notificationEmail' as "notificationEmail",
          u.metadata->>'emailFrequency' as "emailFrequency",
          u.metadata->>'instantNotifications' as "instantNotifications",
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
        // User doesn't exist, try to get token info and create them
        logRequest(context, 'User not found, attempting to create', { userId });
        
        // Get user info from token
        const tokenInfo = context.token || {};
        const email = tokenInfo.email;
        const name = tokenInfo.name || email?.split('@')[0] || 'User';
        
        if (!email) {
          throw new AppError(
            USER_ERRORS.INVALID_TOKEN.code,
            'Token missing required email claim',
            401,
            { userId }
          );
        }

        // Create the user
        const createResult = await query(
          `INSERT INTO users (
            id,
            email,
            display_name,
            metadata
          ) VALUES ($1, $2, $3, $4)
          RETURNING 
            id,
            email,
            display_name as name,
            metadata->>'avatar' as avatar,
            metadata->>'bio' as bio,
            metadata->>'theme' as theme,
            metadata->>'language' as language,
            metadata->>'emailNotifications' as "emailNotifications",
            metadata->>'notificationEmail' as "notificationEmail",
            metadata->>'emailFrequency' as "emailFrequency",
            metadata->>'instantNotifications' as "instantNotifications",
            updated_at as "lastLogin",
            true as "emailVerified"`,
          [
            userId,
            email,
            name,
            JSON.stringify({
              emailNotifications: true,
              emailFrequency: 'immediate',
              instantNotifications: true,
              notificationEmail: email
            })
          ]
        );

        const newUser = createResult.rows[0];
        newUser.subscriptionCount = 0;
        newUser.notificationCount = 0;
        newUser.lastNotification = null;
        newUser.emailNotifications = newUser.emailNotifications === 'true';
        newUser.instantNotifications = newUser.instantNotifications === 'true';

        logRequest(context, 'User created successfully', { 
          userId,
          email: newUser.email
        });

        return newUser;
      }

      // Convert string boolean to actual boolean
      const profile = result.rows[0];
      profile.emailNotifications = profile.emailNotifications === 'true';
      profile.instantNotifications = profile.instantNotifications === 'true';
      
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
      if (updates.emailFrequency !== undefined) {
        notificationUpdates.emailFrequency = updates.emailFrequency;
      }
      if (updates.instantNotifications !== undefined) {
        notificationUpdates.instantNotifications = updates.instantNotifications;
      }

      // Merge all updates into a single metadata update
      const metadataUpdates = {
        ...preferenceUpdates,
        ...notificationUpdates
      };

      const result = await query(
        `UPDATE users 
         SET 
           display_name = COALESCE($1, display_name),
           metadata = metadata || $2::jsonb,
           updated_at = NOW()
         WHERE id = $3
         RETURNING 
           id,
           email,
           display_name as name,
           metadata->>'avatar' as avatar,
           metadata->>'bio' as bio,
           metadata->>'theme' as theme,
           metadata->>'language' as language,
           metadata->>'emailNotifications' as "emailNotifications",
           metadata->>'notificationEmail' as "notificationEmail", 
           metadata->>'emailFrequency' as "emailFrequency",
           metadata->>'instantNotifications' as "instantNotifications",
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
          JSON.stringify(metadataUpdates),
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
      profile.instantNotifications = profile.instantNotifications === 'true';

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

  async updateNotificationSettings(userId, settings, context) {
    logRequest(context, 'Updating notification settings', { 
      userId,
      updateFields: Object.keys(settings)
    });

    try {
      // Validate settings
      if (settings.emailFrequency && settings.emailFrequency !== 'daily') {
        throw new AppError(
          'INVALID_EMAIL_FREQUENCY',
          'Invalid email frequency. Supported values: daily',
          400,
          { allowedFrequencies: ['daily'] }
        );
      }

      // Prepare updates object for metadata
      const updates = {};
      if (settings.emailNotifications !== undefined) {
        updates.emailNotifications = settings.emailNotifications;
      }
      if (settings.notificationEmail !== undefined) {
        updates.notificationEmail = settings.notificationEmail;
      }
      if (settings.emailFrequency !== undefined) {
        updates.emailFrequency = settings.emailFrequency;
      }
      if (settings.instantNotifications !== undefined) {
        updates.instantNotifications = settings.instantNotifications;
      }

      // Update the user metadata
      const result = await query(
        `UPDATE users 
         SET 
           metadata = metadata || $1::jsonb,
           updated_at = NOW()
         WHERE id = $2
         RETURNING 
           metadata->>'emailNotifications' as "emailNotifications",
           metadata->>'notificationEmail' as "notificationEmail",
           metadata->>'emailFrequency' as "emailFrequency",
           metadata->>'instantNotifications' as "instantNotifications"`,
        [
          JSON.stringify(updates),
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

      // Convert string booleans to actual booleans
      const notificationSettings = result.rows[0];
      notificationSettings.emailNotifications = notificationSettings.emailNotifications === 'true';
      notificationSettings.instantNotifications = notificationSettings.instantNotifications === 'true';

      logRequest(context, 'Notification settings updated', {
        userId,
        updatedFields: Object.keys(settings)
      });

      return notificationSettings;
    } catch (error) {
      logError(context, error, { userId });
      
      if (error instanceof AppError) {
        throw error;
      }
      
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