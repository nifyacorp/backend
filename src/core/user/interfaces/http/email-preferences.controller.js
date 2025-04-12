import { query } from '../../../../infrastructure/database/client.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../../shared/logging/logger.js';

/**
 * Get user email preferences
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function getEmailPreferences(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method,
    userId: request.user?.id
  };

  try {
    logRequest(context, 'Getting email preferences');

    if (!request.user?.id) {
      throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
    }

    // Get user data including metadata
    const result = await query(
      'SELECT email, metadata FROM users WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const user = result.rows[0];
    const metadata = user.metadata || {};
    
    // Extract email preferences from metadata JSONB structure
    const emailPrefs = {
      email_notifications: metadata?.notifications?.email?.enabled || true,
      notification_email: metadata?.notifications?.email?.useCustomEmail ? 
        metadata?.notifications?.email?.customEmail : 
        null,
      digest_time: metadata?.notifications?.email?.digestTime || '08:00'
    };

    return { preferences: emailPrefs };
  } catch (error) {
    logError(context, error);
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      status: 500,
      timestamp: new Date().toISOString()
    };
    
    reply.code(response.status).send(response);
  }
}

/**
 * Update user email preferences
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function updateEmailPreferences(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method,
    userId: request.user?.id
  };

  try {
    logRequest(context, 'Updating email preferences', {
      updateFields: Object.keys(request.body || {})
    });

    if (!request.user?.id) {
      throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
    }

    // Get current user data
    const userResult = await query(
      'SELECT email, metadata FROM users WHERE id = $1',
      [request.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const userData = userResult.rows[0];
    const metadata = JSON.parse(JSON.stringify(userData.metadata || {}));

    // Ensure the notifications.email structure exists
    if (!metadata.notifications) metadata.notifications = {};
    if (!metadata.notifications.email) metadata.notifications.email = {};

    // Update the email preferences in metadata
    if (request.body.email_notifications !== undefined) {
      metadata.notifications.email.enabled = request.body.email_notifications;
    }

    if (request.body.notification_email !== undefined) {
      const useCustomEmail = request.body.notification_email !== null;
      metadata.notifications.email.useCustomEmail = useCustomEmail;
      metadata.notifications.email.customEmail = request.body.notification_email;
    }

    if (request.body.digest_time !== undefined) {
      metadata.notifications.email.digestTime = request.body.digest_time;
    }

    // Update the user with new metadata
    await query(
      'UPDATE users SET metadata = $1 WHERE id = $2',
      [metadata, request.user.id]
    );

    // Format response
    const updatedPrefs = {
      email_notifications: metadata.notifications.email.enabled,
      notification_email: metadata.notifications.email.useCustomEmail ? 
        metadata.notifications.email.customEmail : 
        null,
      digest_time: metadata.notifications.email.digestTime || '08:00'
    };

    return { preferences: updatedPrefs };
  } catch (error) {
    logError(context, error);
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      status: 500,
      timestamp: new Date().toISOString()
    };
    
    reply.code(response.status).send(response);
  }
}

/**
 * Send a test email to the user
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function sendTestEmail(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method,
    userId: request.user?.id
  };

  try {
    logRequest(context, 'Sending test email');

    if (!request.user?.id) {
      throw new AppError('UNAUTHORIZED', 'No user ID available', 401);
    }

    // Get user data
    const result = await query(
      'SELECT email, metadata FROM users WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const user = result.rows[0];
    const metadata = user.metadata || {};
    
    // Get email to use (custom email or primary email)
    const useCustomEmail = metadata?.notifications?.email?.useCustomEmail || false;
    const emailToUse = useCustomEmail ? 
      metadata?.notifications?.email?.customEmail : 
      user.email;

    if (!emailToUse) {
      throw new AppError('BAD_REQUEST', 'No valid email address found', 400);
    }

    // In a real implementation, you would send an actual email here
    // For now, we'll just simulate success
    
    return { 
      success: true,
      message: `Test email would be sent to: ${emailToUse}`,
      email: emailToUse
    };
  } catch (error) {
    logError(context, error);
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      status: 500,
      timestamp: new Date().toISOString()
    };
    
    reply.code(response.status).send(response);
  }
}

/**
 * Mark notifications as sent via email
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function markNotificationsAsSent(request, reply) {
  const context = {
    requestId: request.id,
    path: request.url,
    method: request.method,
    userId: request.user?.id || 'system'
  };

  try {
    logRequest(context, 'Marking notifications as sent via email', {
      notificationCount: request.body.notification_ids?.length || 0
    });

    const { notification_ids, sent_at } = request.body;
    
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      throw new AppError('BAD_REQUEST', 'No notification IDs provided', 400);
    }

    const timestamp = sent_at ? new Date(sent_at) : new Date();
    
    // Update notifications to mark them as sent
    const result = await query(
      `UPDATE notifications 
       SET email_sent = true, email_sent_at = $1 
       WHERE id = ANY($2)
       RETURNING id`,
      [timestamp, notification_ids]
    );

    return {
      message: 'Notifications marked as sent',
      updated: result.rows.length,
      timestamp: timestamp.toISOString()
    };
  } catch (error) {
    logError(context, error);
    const response = error instanceof AppError ? error.toJSON() : {
      error: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      status: 500,
      timestamp: new Date().toISOString()
    };
    
    reply.code(response.status).send(response);
  }
} 