const db = require('../utils/db');
const logger = require('../utils/logger');
const paymentService = require('./payment-service');
const notificationService = require('./notification-service');
const { performance } = require('perf_hooks');
const metrics = require('../utils/metrics');

/**
 * Verify if a user has permission to process a subscription
 */
async function verifyUserPermission(userId, subscriptionId) {
  try {
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE id = ? AND (user_id = ? OR user_role = "admin")',
      [subscriptionId, userId]
    );
    return result.length > 0;
  } catch (error) {
    logger.error('Permission verification error', { 
      error: error.message, 
      userId, 
      subscriptionId 
    });
    return false;
  }
}

/**
 * Get subscription details
 */
async function getSubscription(subscriptionId) {
  try {
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    return result[0];
  } catch (error) {
    logger.error('Error fetching subscription', { 
      error: error.message, 
      subscriptionId 
    });
    throw error;
  }
}

/**
 * Process a subscription
 */
async function processSubscription(subscriptionId, transactionId) {
  // Start performance measurement
  const startTime = performance.now();
  metrics.increment('subscription.processing.attempt', { subscriptionId });

  try {
    // Set up transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Phase 2: Database Operations
    // Transaction Isolation Level Check
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');

    // Fetch subscription details
    const subscriptionQuery = 'SELECT * FROM subscriptions WHERE id = ?';
    const [subscription] = await connection.query(subscriptionQuery, [subscriptionId]);

    if (!subscription) {
      logger.error('Subscription not found', { subscriptionId, transactionId });
      await connection.rollback();
      metrics.increment('subscription.processing.failure', { 
        subscriptionId, 
        reason: 'not_found' 
      });
      throw new Error('Subscription not found');
    }

    // Phase 3: Payment Processing
    // Payment Gateway Integration Logging
    logger.debug('Initiating payment gateway request', {
      subscriptionId,
      transactionId,
      gateway: process.env.PAYMENT_PROVIDER || 'DEFAULT_PROVIDER',
      amount: subscription.amount
    });

    const paymentStartTime = performance.now();
    try {
      const paymentResult = await paymentService.processPayment(
        subscription.id,
        subscription.amount,
        subscription.user_id,
        transactionId
      );
      
      const paymentResponseTime = performance.now() - paymentStartTime;
      logger.debug('Payment gateway response', { 
        paymentResult, 
        transactionId,
        responseTime: paymentResponseTime 
      });
      
      // Update subscription status based on payment result
      const updateQuery = 'UPDATE subscriptions SET status = ?, last_processed = NOW(), payment_reference = ? WHERE id = ?';
      await connection.query(updateQuery, [
        paymentResult.status, 
        paymentResult.reference, 
        subscriptionId
      ]);
      
    } catch (error) {
      logger.error('Payment gateway error', { 
        error: error.message, 
        errorCode: error.code || 'UNKNOWN',
        transactionId 
      });
      
      // Update subscription with failed status
      const updateQuery = 'UPDATE subscriptions SET status = ?, last_processed = NOW(), last_error = ? WHERE id = ?';
      await connection.query(updateQuery, [
        'payment_failed', 
        error.message, 
        subscriptionId
      ]);
      
      await connection.commit();
      metrics.increment('subscription.processing.failure', { 
        subscriptionId, 
        reason: 'payment_failed' 
      });
      throw error;
    }
    
    // Fetch updated subscription
    const [updatedSubscription] = await connection.query(subscriptionQuery, [subscriptionId]);
    
    // Phase 4: Notification Generation
    // Event Emission Logging
    logger.debug('Emitting notification event', {
      eventType: 'SUBSCRIPTION_PROCESSED',
      subscriptionId,
      transactionId,
      timestamp: new Date().toISOString()
    });
    
    // Generate notification for subscription processing
    await notificationService.createNotification({
      userId: subscription.user_id,
      type: 'SUBSCRIPTION_PROCESSED',
      content: {
        subscriptionId,
        processedAt: new Date().toISOString(),
        status: updatedSubscription.status
      },
      transactionId
    });
    
    // Commit transaction
    await connection.commit();
    
    // Record success metrics
    const duration = performance.now() - startTime;
    metrics.timing('subscription.processing.duration', duration);
    metrics.increment('subscription.processing.success', { subscriptionId });
    
    logger.info('Subscription processed successfully', { 
      subscriptionId, 
      transactionId,
      duration 
    });
    
    return updatedSubscription;
    
  } catch (error) {
    // If we haven't already handled the error and rolled back
    if (connection && connection.rollback) {
      await connection.rollback();
    }
    
    logger.error('Subscription processing failed', { 
      error: error.message, 
      stack: error.stack,
      subscriptionId,
      transactionId 
    });
    
    // Record failure metrics if not already recorded
    metrics.increment('subscription.processing.failure', { 
      subscriptionId, 
      reason: error.code || 'unknown_error' 
    });
    
    throw error;
  } finally {
    if (connection && connection.release) {
      connection.release();
    }
  }
}

module.exports = {
  verifyUserPermission,
  getSubscription,
  processSubscription
}; 