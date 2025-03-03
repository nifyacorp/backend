const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const subscriptionService = require('../services/subscription-service');
const paymentService = require('../services/payment-service');
const notificationService = require('../services/notification-service');

// Endpoint for manually processing a subscription
router.post('/:id/process', async (req, res) => {
  try {
    // Phase 1: Subscription Processing Initiation
    // 1. API Endpoint Logging
    logger.debug('Manual subscription processing initiated', { 
      subscriptionId: req.params.id, 
      userId: req.user.id, 
      timestamp: new Date().toISOString() 
    });

    // 2. Request Validation Check
    if (!req.params.id) {
      logger.error('Subscription ID missing', { userId: req.user.id });
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    // Verify user has permission to process this subscription
    const canProcess = await subscriptionService.verifyUserPermission(req.user.id, req.params.id);
    if (!canProcess) {
      logger.error('Permission denied', { 
        userId: req.user.id, 
        subscriptionId: req.params.id
      });
      return res.status(403).json({ error: 'Not authorized to process this subscription' });
    }

    // 3. Transaction Boundary Setup
    const transactionId = uuidv4();
    logger.info('Starting subscription processing transaction', { 
      transactionId,
      subscriptionId: req.params.id
    });

    // Phase 2: Database Operations
    // Data Integrity Verification - Before state
    const subscription = await subscriptionService.getSubscription(req.params.id);
    logger.debug('Subscription state before processing', { 
      subscription, 
      transactionId 
    });

    // Process the subscription
    const processedSubscription = await subscriptionService.processSubscription(
      req.params.id, 
      transactionId
    );

    // Respond to client
    res.status(200).json({ 
      status: 'success', 
      message: 'Subscription processed successfully',
      subscription: processedSubscription
    });

  } catch (error) {
    logger.error('Subscription processing error', { 
      error: error.message, 
      stack: error.stack,
      subscriptionId: req.params.id
    });
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

module.exports = router; 