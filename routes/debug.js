const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const logger = require('../utils/logger');
const logService = require('../services/log-service');

// Only enable these routes in development/staging environments
if (process.env.NODE_ENV !== 'production') {
  // Phase 7: End-to-End Testing Tools
  // 1. Create Debug API Endpoints
  
  /**
   * Trace a notification's journey
   */
  router.get('/notification/:id', async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Fetch the notification record
      const [notification] = await db.query(
        'SELECT * FROM notifications WHERE id = ?',
        [notificationId]
      );
      
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      
      // Gather all logs related to this notification
      const notificationLogs = await logService.queryLogs({ 
        notificationId,
        timeRange: '24h'
      });
      
      res.json({ 
        notificationId, 
        notification, 
        trace: notificationLogs 
      });
    } catch (error) {
      logger.error('Debug endpoint error', {
        error: error.message,
        endpoint: 'notification-trace',
        notificationId: req.params.id
      });
      
      res.status(500).json({ error: 'Failed to trace notification' });
    }
  });
  
  /**
   * Trace a subscription's journey
   */
  router.get('/subscription/:id', async (req, res) => {
    try {
      const subscriptionId = req.params.id;
      
      // Fetch the subscription record
      const [subscription] = await db.query(
        'SELECT * FROM subscriptions WHERE id = ?',
        [subscriptionId]
      );
      
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
      
      // Get any related payments
      const payments = await db.query(
        'SELECT * FROM payments WHERE subscription_id = ? ORDER BY created_at DESC',
        [subscriptionId]
      );
      
      // Get related notifications
      const notifications = await db.query(
        'SELECT * FROM notifications WHERE content LIKE ? ORDER BY created_at DESC',
        [`%${subscriptionId}%`]
      );
      
      // Get logs for this subscription
      const subscriptionLogs = await logService.queryLogs({ 
        subscriptionId,
        timeRange: '24h'
      });
      
      res.json({ 
        subscriptionId, 
        subscription, 
        payments,
        notifications,
        trace: subscriptionLogs 
      });
    } catch (error) {
      logger.error('Debug endpoint error', {
        error: error.message,
        endpoint: 'subscription-trace',
        subscriptionId: req.params.id
      });
      
      res.status(500).json({ error: 'Failed to trace subscription' });
    }
  });
  
  /**
   * Get system health
   */
  router.get('/health', async (req, res) => {
    try {
      // Check database connection
      const dbConnection = await db.ping();
      
      // Check message queue connection if applicable
      let queueConnection = { status: 'not_configured' };
      if (process.env.USE_MESSAGE_QUEUE === 'true') {
        const messageQueue = require('../utils/message-queue');
        queueConnection = await messageQueue.checkConnection();
      }
      
      // Check cache connection if applicable
      let cacheConnection = { status: 'not_configured' };
      if (process.env.USE_REDIS === 'true') {
        const redisClient = require('../utils/redis-client');
        cacheConnection = await redisClient.ping();
      }
      
      const systemHealth = {
        status: dbConnection.connected && 
                (queueConnection.status === 'connected' || queueConnection.status === 'not_configured') &&
                (cacheConnection.status === 'connected' || cacheConnection.status === 'not_configured') 
                ? 'healthy' : 'degraded',
        components: {
          database: dbConnection.connected ? 'connected' : 'disconnected',
          messageQueue: queueConnection.status,
          cache: cacheConnection.status
        },
        timestamp: new Date().toISOString()
      };
      
      logger.debug('Health check performed', systemHealth);
      
      res.json(systemHealth);
    } catch (error) {
      logger.error('Health check error', {
        error: error.message
      });
      
      res.status(500).json({ 
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  /**
   * Re-send a notification in real-time
   */
  router.post('/notification/:id/resend', async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Fetch the notification
      const [notification] = await db.query(
        'SELECT * FROM notifications WHERE id = ?',
        [notificationId]
      );
      
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      
      // Re-send the notification
      const notificationService = require('../services/notification-service');
      await notificationService.deliverNotificationRealtime({
        notificationId: notification.id,
        userId: notification.user_id,
        type: notification.type,
        content: JSON.parse(notification.content),
        transactionId: `resend-${uuidv4()}`
      });
      
      res.json({ 
        status: 'success', 
        message: 'Notification re-sent'
      });
    } catch (error) {
      logger.error('Debug endpoint error', {
        error: error.message,
        endpoint: 'notification-resend',
        notificationId: req.params.id
      });
      
      res.status(500).json({ error: 'Failed to re-send notification' });
    }
  });
}

module.exports = router; 