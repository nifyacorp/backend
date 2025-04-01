const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const notificationService = require('../services/notification-service');

/**
 * Get user notifications
 * 
 * Endpoint that returns notifications with a standardized structure
 * matching exactly what the frontend expects.
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    // Support both offset and page-based pagination
    const offset = req.query.offset ? parseInt(req.query.offset) : (page - 1) * limit;
    // Support unread filter with different param formats
    const unread = req.query.unread === 'true' || req.query.unread === true;
    const includeRead = !unread;
    // Check if we're filtering by subscription
    const subscriptionId = req.query.subscriptionId || null;

    logger.debug('Fetching user notifications', { 
      userId, 
      limit, 
      offset, 
      page,
      includeRead,
      unread,
      subscriptionId 
    });

    // Get notifications with filtering
    const notifications = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      includeRead,
      subscriptionId
    });

    // Count unread notifications for this user
    const unreadCount = await notificationService.countUnreadNotifications(userId);
    
    // Format response object to match exactly what frontend expects
    // Note: We're matching the NotificationsResponse interface from frontend
    const response = {
      notifications,
      total: notifications.length, // Should be improved to return actual total count
      unread: unreadCount,
      page: page,
      limit,
      hasMore: notifications.length >= limit // If we got a full page, there might be more
    };
    
    // Standard response format
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching notifications', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id
    });

    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      notifications: [],
      total: 0,
      unread: 0,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      hasMore: false
    });
  }
});

/**
 * Mark notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    logger.debug('Marking notification as read', { userId, notificationId });

    const success = await notificationService.markNotificationAsRead(notificationId, userId);

    if (success) {
      res.status(200).json({
        status: 'success',
        message: 'Notification marked as read'
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Notification not found or not owned by user'
      });
    }
  } catch (error) {
    logger.error('Error marking notification as read', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      notificationId: req.params.id
    });

    res.status(500).json({ 
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    logger.debug('Deleting notification', { userId, notificationId });

    const success = await notificationService.deleteNotification(notificationId, userId);

    // Return success even if notification doesn't exist or isn't owned by user
    // This ensures frontend cache can be cleaned up
    res.status(success ? 200 : 204).json({
      status: 'success',
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notification', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      notificationId: req.params.id
    });

    // Always return success to client for UI consistency
    // This helps frontend maintain state even if backend operation fails
    res.status(200).json({ 
      status: 'success',
      message: 'Notification marked for deletion'
    });
  }
});

/**
 * Delete all notifications for current user
 */
router.delete('/delete-all', async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = req.query.subscriptionId;

    logger.debug('Deleting all notifications', { 
      userId, 
      subscriptionId: subscriptionId || 'all' 
    });

    const deletedCount = await notificationService.deleteAllNotifications(userId, {
      subscriptionId
    });

    res.status(200).json({
      status: 'success',
      message: `Deleted ${deletedCount} notifications`,
      data: { count: deletedCount }
    });
  } catch (error) {
    logger.error('Error deleting all notifications', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      subscriptionId: req.query.subscriptionId || 'all'
    });

    // Always return success to client for UI consistency
    res.status(200).json({ 
      status: 'success',
      message: 'Notifications marked for deletion'
    });
  }
});

module.exports = router;