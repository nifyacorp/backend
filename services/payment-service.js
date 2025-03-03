const logger = require('../utils/logger');
const paymentGateway = require('../utils/payment-gateway');
const metrics = require('../utils/metrics');

/**
 * Process a payment for a subscription
 */
async function processPayment(subscriptionId, amount, userId, transactionId) {
  logger.debug('Payment processing started', {
    subscriptionId,
    amount,
    userId,
    transactionId
  });

  metrics.increment('payment.attempt', { subscriptionId });
  
  try {
    // Track payment state
    logger.debug('Payment state transition', {
      subscriptionId,
      transactionId,
      from: 'pending',
      to: 'processing'
    });

    // Process payment through gateway
    const paymentResult = await paymentGateway.processPayment({
      amount,
      userId,
      subscriptionId,
      metadata: {
        transactionId
      }
    });

    // Log success state transition
    logger.debug('Payment state transition', {
      subscriptionId,
      transactionId,
      from: 'processing',
      to: 'completed',
      paymentReference: paymentResult.reference
    });

    // Track payment external reference
    logger.info('Payment reference received', {
      subscriptionId,
      transactionId,
      paymentReference: paymentResult.reference,
      providerId: paymentResult.providerId
    });

    metrics.increment('payment.success', { 
      subscriptionId,
      gateway: process.env.PAYMENT_PROVIDER || 'DEFAULT_PROVIDER'
    });

    return {
      status: 'active',
      reference: paymentResult.reference,
      providerId: paymentResult.providerId
    };
  } catch (error) {
    // Log failure state transition
    logger.debug('Payment state transition', {
      subscriptionId,
      transactionId,
      from: 'processing',
      to: 'failed',
      error: error.message
    });

    logger.error('Payment processing error', {
      subscriptionId,
      userId,
      transactionId,
      error: error.message,
      errorCode: error.code || 'UNKNOWN',
      errorDetails: error.details || {}
    });

    metrics.increment('payment.failure', { 
      subscriptionId,
      reason: error.code || 'unknown_error',
      gateway: process.env.PAYMENT_PROVIDER || 'DEFAULT_PROVIDER'
    });

    throw error;
  }
}

module.exports = {
  processPayment
}; 