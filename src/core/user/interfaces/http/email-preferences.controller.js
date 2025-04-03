import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';
import { query } from '../../../../infrastructure/database/client.js';
import { publishEvent } from '../../../../infrastructure/pubsub/client.js';

/**
 * Get email notification preferences for a user
 */
export async function getEmailPreferences(request, reply) {
  const userId = request.user?.id;
  
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method
  };
  
  try {
    logRequest(context, 'Getting email preferences', { userId });
    
    const result = await query(
      `SELECT 
        metadata->>'emailNotifications' as email_notifications, 
        metadata->>'notificationEmail' as notification_email, 
        metadata->>'digestTime' as digest_time
      FROM users
      WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Return default preferences if not found
      return {
        email_notifications: false,
        notification_email: null,
        digest_time: '08:00:00'
      };
    }
    
    return result.rows[0];
  } catch (error) {
    logError(context, error);
    throw new AppError(
      'DATABASE_ERROR',
      'Failed to retrieve email preferences',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Update email notification preferences for a user
 */
export async function updateEmailPreferences(request, reply) {
  const userId = request.user?.id;
  
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method
  };
  
  try {
    const { email_notifications, notification_email, digest_time } = request.body;
    
    logRequest(context, 'Updating email preferences', {
      userId,
      email_notifications,
      notification_email,
      digest_time
    });
    
    // Build a JSON object for metadata update
    const metadataUpdates = {};
    
    // Only include fields that were provided in the request
    if (email_notifications !== undefined) {
      metadataUpdates.emailNotifications = email_notifications;
    }
    
    if (notification_email !== undefined) {
      metadataUpdates.notificationEmail = notification_email;
    }
    
    if (digest_time !== undefined) {
      metadataUpdates.digestTime = digest_time;
    }
    
    if (Object.keys(metadataUpdates).length === 0) {
      return { message: 'No changes to update' };
    }
    
    const result = await query(
      `UPDATE users 
       SET metadata = metadata || $2::jsonb
       WHERE id = $1
       RETURNING 
         metadata->>'emailNotifications' as email_notifications, 
         metadata->>'notificationEmail' as notification_email, 
         metadata->>'digestTime' as digest_time`,
      [userId, JSON.stringify(metadataUpdates)]
    );
    
    // Publish event for preference change
    try {
      await publishEvent('user.email_preferences_updated', {
        user_id: userId,
        email_notifications: result.rows[0].email_notifications,
        has_notification_email: !!result.rows[0].notification_email,
        digest_time: result.rows[0].digest_time,
        timestamp: new Date().toISOString()
      });
    } catch (pubsubError) {
      logError(context, pubsubError, 'Failed to publish email preferences update event');
      // Continue despite publish error
    }
    
    return {
      message: 'Email preferences updated successfully',
      preferences: result.rows[0]
    };
  } catch (error) {
    logError(context, error);
    throw new AppError(
      'DATABASE_ERROR',
      'Failed to update email preferences',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Send a test email to verify notification setup
 */
export async function sendTestEmail(request, reply) {
  const userId = request.user?.id;
  
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method
  };
  
  try {
    const { email } = request.body;
    
    logRequest(context, 'Sending test email', { userId, email });
    
    // Get user details for the test email
    const userResult = await query(
      `SELECT email, metadata->>'notificationEmail' as notification_email 
       FROM users
       WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }
    
    // Use the provided email, or fallback to the user's notification email or account email
    const recipientEmail = email || 
                          userResult.rows[0].notification_email || 
                          userResult.rows[0].email;
    
    if (!recipientEmail) {
      throw new AppError(
        'VALIDATION_ERROR',
        'No email address provided or available for the user',
        400
      );
    }
    
    // Publish event to send test email
    await publishEvent('email.test', {
      user_id: userId,
      email: recipientEmail,
      timestamp: new Date().toISOString()
    });
    
    return {
      message: 'Test email sent successfully',
      email: recipientEmail
    };
  } catch (error) {
    logError(context, error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'SERVER_ERROR',
      'Failed to send test email',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Mark notifications as sent via email
 * This is called by the email notification service after sending notifications
 */
export async function markNotificationsAsSent(request, reply) {
  // Require admin or service account authentication for this endpoint
  if (!request.user?.isAdmin && !request.user?.isService) {
    throw new AppError('UNAUTHORIZED', 'Admin or service account required', 403);
  }
  
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method
  };
  
  try {
    const { notification_ids, sent_at } = request.body;
    
    if (!notification_ids || notification_ids.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No notification IDs provided', 400);
    }
    
    logRequest(context, 'Marking notifications as sent via email', {
      notificationCount: notification_ids.length,
      sent_at
    });
    
    const timestamp = sent_at || new Date().toISOString();
    
    // Update notifications in a single query
    const result = await query(
      `UPDATE notifications
       SET email_sent = TRUE, email_sent_at = $1
       WHERE id = ANY($2)
       RETURNING id`,
      [timestamp, notification_ids]
    );
    
    return {
      message: 'Notifications marked as sent via email',
      updated: result.rowCount,
      timestamp
    };
  } catch (error) {
    logError(context, error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'DATABASE_ERROR',
      'Failed to mark notifications as sent',
      500,
      { originalError: error.message }
    );
  }
}