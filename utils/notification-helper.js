/**
 * Notification Helper Utilities
 * 
 * This file provides standardized functions for working with notifications
 * consistently across different parts of the application.
 */

const logger = require('./logger');

/**
 * Extract a title from notification content using multiple fallback strategies
 * to ensure notifications always have a meaningful title.
 * 
 * @param {Object} content - The notification content object
 * @param {string} type - The notification type
 * @param {string} userId - The user ID receiving the notification
 * @returns {string} The extracted or generated title
 */
function extractNotificationTitle(content, type, userId) {
  try {
    // Use explicit title field if available
    if (content.title) {
      return content.title;
    }

    // Check alternative title fields
    if (content.notification_title) {
      return content.notification_title;
    }

    if (content.message_title) {
      return content.message_title;
    }

    if (content.subject) {
      return content.subject;
    }

    // Check for title in message object
    if (content.message && typeof content.message === 'object' && content.message.title) {
      return content.message.title;
    }

    // Check for title in nested metadata
    if (content.metadata) {
      // Handle either string or object
      const metadata = typeof content.metadata === 'string' 
        ? JSON.parse(content.metadata) 
        : content.metadata;

      // Direct metadata title
      if (metadata.title) {
        return metadata.title;
      }

      // BOE-specific metadata
      if (metadata.boe_data && metadata.boe_data.title) {
        return metadata.boe_data.title;
      }

      // Deeply nested metadata - check common structures
      if (metadata.data?.result?.title) {
        return metadata.data.result.title;
      }
    }

    // If BOE notification, look deeper in content
    if (type === 'BOE_NOTIFICATION' || content.entity_type === 'BOE') {
      // Special check for BOE notifications with deeply nested structures
      if (content.metadata?.boe_data?.title) {
        return content.metadata.boe_data.title;
      }

      if (content.data?.boe?.title) {
        return content.data.boe.title;
      }

      // Default BOE title with document ID if available
      return content.documentId ? `BOE Document: ${content.documentId}` : 'BOE Notification';
    }

    // Generate a title from entity_type and subscription_name
    if (content.entity_type && content.subscription_name) {
      return `${content.entity_type}: ${content.subscription_name}`;
    }

    if (content.entity_type) {
      // Properly format entity_type
      const formattedType = content.entity_type
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
      return `New ${formattedType} Notification`;
    }

    // Use subscription-related fields to generate title
    if (content.subscriptionId || content.subscription_id) {
      return `Subscription Update: ${content.subscription_name || content.subscriptionId || content.subscription_id}`;
    }

    // Use notification type as a fallback
    if (type) {
      // Format the type into a readable title
      const formattedType = type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
      return formattedType;
    }

    // Absolute fallback
    return 'New Notification';
  } catch (error) {
    logger.warn('Error extracting notification title', {
      error: error.message,
      content: typeof content === 'object' ? JSON.stringify(content).substring(0, 200) : content,
      userId
    });
    
    // Safe fallback
    return 'New Notification';
  }
}

/**
 * Normalize notification content for consistent structure
 * regardless of the source or format
 * 
 * @param {Object} notification - The raw notification object
 * @returns {Object} Normalized notification with consistent fields
 */
function normalizeNotification(notification) {
  try {
    // Ensure content is an object
    let content = notification.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (e) {
        content = { message: content };
      }
    }

    // Extract the title using our robust extraction logic
    const title = extractNotificationTitle(content, notification.type, notification.user_id);

    // Create a normalized notification object
    return {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title,
      content,
      read: notification.read || false,
      createdAt: notification.created_at || notification.createdAt || new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error normalizing notification', {
      error: error.message,
      notification: notification?.id
    });
    
    // Return a valid object even on error
    return {
      id: notification.id || 'error',
      userId: notification.user_id || notification.userId || 'unknown',
      type: notification.type || 'ERROR',
      title: 'Error Processing Notification',
      content: { error: 'Failed to normalize notification content' },
      read: notification.read || false,
      createdAt: notification.created_at || notification.createdAt || new Date().toISOString()
    };
  }
}

/**
 * Check if a notification appears to be a duplicate
 * based on its content and timing
 * 
 * @param {Object} newNotification - The notification to check for duplication
 * @param {Array} existingNotifications - Array of existing notifications
 * @returns {boolean} True if the notification appears to be a duplicate
 */
function isDuplicateNotification(newNotification, existingNotifications) {
  if (!existingNotifications || existingNotifications.length === 0) {
    return false;
  }

  // Look for similar notifications in the last 12 hours
  const twelveHoursAgo = new Date();
  twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
  
  return existingNotifications.some(existing => {
    // Check creation time (must be within 12 hours)
    const existingDate = new Date(existing.created_at || existing.createdAt);
    if (existingDate < twelveHoursAgo) {
      return false;
    }
    
    // Check basic properties
    if (existing.type !== newNotification.type) {
      return false;
    }
    
    // Check for subscription ID match
    const newContent = typeof newNotification.content === 'string' 
      ? JSON.parse(newNotification.content) 
      : newNotification.content;
      
    const existingContent = typeof existing.content === 'string'
      ? JSON.parse(existing.content)
      : existing.content;
      
    // Check if subscription IDs match
    if (newContent.subscriptionId && existingContent.subscriptionId) {
      return newContent.subscriptionId === existingContent.subscriptionId;
    }
    
    // Check for title similarity
    const newTitle = extractNotificationTitle(newContent, newNotification.type, newNotification.user_id);
    const existingTitle = extractNotificationTitle(existingContent, existing.type, existing.user_id);
    
    return newTitle === existingTitle;
  });
}

module.exports = {
  extractNotificationTitle,
  normalizeNotification,
  isDuplicateNotification
};