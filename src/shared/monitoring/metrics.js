/**
 * StatsD Metrics Integration
 * 
 * This file provides a metrics collection interface using hot-shots (StatsD client).
 */

import StatsD from 'hot-shots';
import { logger } from '../logging/logger.js';

// Create a StatsD client
const client = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: 'subscription_service.',
  errorHandler: (error) => {
    logger.error({ error }, 'StatsD error');
  },
  globalTags: {
    env: process.env.NODE_ENV || 'development',
    service: 'backend-service'
  }
});

// Flag to disable metrics in test environments
const isEnabled = process.env.NODE_ENV !== 'test';

/**
 * Increment a counter
 * @param {string} stat - Metric name
 * @param {Object} tags - Tags to associate with the metric
 * @param {number} value - Value to increment by (default: 1)
 */
export function increment(stat, tags = {}, value = 1) {
  if (!isEnabled) return;
  
  try {
    client.increment(stat, value, tags);
  } catch (error) {
    logger.error({ error, stat, tags }, 'Error incrementing metric');
  }
}

/**
 * Record a timing measurement
 * @param {string} stat - Metric name
 * @param {number} time - Time value in milliseconds
 * @param {Object} tags - Tags to associate with the metric
 */
export function timing(stat, time, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.timing(stat, time, tags);
  } catch (error) {
    logger.error({ error, stat, time, tags }, 'Error recording timing metric');
  }
}

/**
 * Record a gauge measurement
 * @param {string} stat - Metric name
 * @param {number} value - Gauge value
 * @param {Object} tags - Tags to associate with the metric
 */
export function gauge(stat, value, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.gauge(stat, value, tags);
  } catch (error) {
    logger.error({ error, stat, value, tags }, 'Error recording gauge metric');
  }
}

/**
 * Record a histogram value
 * @param {string} stat - Metric name
 * @param {number} value - Histogram value
 * @param {Object} tags - Tags to associate with the metric
 */
export function histogram(stat, value, tags = {}) {
  if (!isEnabled) return;
  
  try {
    client.histogram(stat, value, tags);
  } catch (error) {
    logger.error({ error, stat, value, tags }, 'Error recording histogram metric');
  }
}

/**
 * Time an async function execution
 * @param {string} stat - Metric name
 * @param {Function} func - Async function to time
 * @param {Object} tags - Tags to associate with the metric
 * @returns {Promise<any>} - Result of the async function
 */
export async function timeAsync(stat, func, tags = {}) {
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