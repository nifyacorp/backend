const StatsD = require('hot-shots');
const logger = require('./logger');

// Create a StatsD client
const client = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: 'subscription_service.',
  errorHandler: (error) => {
    logger.error('StatsD error', { error: error.message });
  },
  globalTags: {
    env: process.env.NODE_ENV || 'development',
    service: 'subscription-service'
  }
});

// Flag to disable metrics in test environments
const isEnabled = process.env.NODE_ENV !== 'test';

/**
 * Increment a counter
 */
function increment(stat, tags = {}, value = 1) {
  if (!isEnabled) return;
  
  try {
    client.increment(stat, value, tags);
  } catch (error) {
    logger.error('Error incrementing metric', { 
      error: error.message, 
      stat, 
      tags 
    });
  }
}

/**
 * Record a timing measurement
 */
function timing(stat, time, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.timing(stat, time, tags);
  } catch (error) {
    logger.error('Error recording timing metric', { 
      error: error.message, 
      stat, 
      time, 
      tags 
    });
  }
}

/**
 * Record a gauge measurement
 */
function gauge(stat, value, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.gauge(stat, value, tags);
  } catch (error) {
    logger.error('Error recording gauge metric', { 
      error: error.message, 
      stat, 
      value, 
      tags 
    });
  }
}

/**
 * Record a histogram value
 */
function histogram(stat, value, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.histogram(stat, value, tags);
  } catch (error) {
    logger.error('Error recording histogram metric', { 
      error: error.message, 
      stat, 
      value, 
      tags 
    });
  }
}

/**
 * Time an async function execution
 */
async function timeAsync(stat, func, tags = {}) {
  if (!isEnabled) {
    return await func();
  }
  
  const startTime = Date.now();
  
  try {
    const result = await func();
    const duration = Date.now() - startTime;
    
    timing(stat, duration, tags);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    timing(`${stat}.error`, duration, {
      ...tags,
      error: error.name
    });
    
    throw error;
  }
}

// Phase 8: Monitoring and Alerting
// 1. Failure Rate Monitoring and 2. Performance Metrics Collection
module.exports = {
  increment,
  timing,
  gauge,
  histogram,
  timeAsync
}; 