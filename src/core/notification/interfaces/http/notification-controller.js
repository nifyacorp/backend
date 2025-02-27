import notificationService from '../../notification-service.js';
import logger from '../../../../shared/logger.js';

/**
 * Get notifications for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getUserNotifications = async (req, res) => {
  try {
    // The userId comes from the authenticated user
    const userId = req.user.id;
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';
    const subscriptionId = req.query.subscriptionId || null;
    
    // Get notifications using the service
    const result = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
      subscriptionId
    });
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error in notification controller getUserNotifications', {
      userId: req.user?.id,
      error: error.message
    });
    return res.status(500).json({ 
      error: 'Failed to retrieve notifications', 
      message: error.message 
    });
  }
};

/**
 * Mark a notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    if (!notificationId) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }
    
    const result = await notificationService.markNotificationAsRead(notificationId, userId);
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error in notification controller markAsRead', {
      userId: req.user?.id,
      notificationId: req.params.notificationId,
      error: error.message
    });
    return res.status(500).json({ 
      error: 'Failed to mark notification as read', 
      message: error.message 
    });
  }
};

/**
 * Mark all notifications as read for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.query;
    
    const result = await notificationService.markAllNotificationsAsRead(userId, subscriptionId);
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error in notification controller markAllAsRead', {
      userId: req.user?.id,
      subscriptionId: req.query.subscriptionId,
      error: error.message
    });
    return res.status(500).json({ 
      error: 'Failed to mark all notifications as read', 
      message: error.message 
    });
  }
};

export default {
  getUserNotifications,
  markAsRead,
  markAllAsRead
}; 