/**
 * Metrics Service
 * 
 * Provides centralized metrics collection functionality for monitoring
 * application performance and events.
 */

import { logger } from '../../shared/logging/logger.js';

// Basic metrics implementation for development
class Metrics {
  constructor() {
    this.metricsEnabled = process.env.ENABLE_METRICS === 'true';
    this.counters = new Map();
    this.gauges = new Map();
    this.timers = new Map();
    
    logger.info('Metrics service initialized', { 
      enabled: this.metricsEnabled,
      environment: process.env.NODE_ENV || 'development'
    });
  }
  
  // Increment a counter
  increment(name, value = 1, tags = {}) {
    if (!this.metricsEnabled) return;
    
    const key = this._formatKey(name, tags);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Metric incremented: ${key}`, { 
        value, 
        currentValue: currentValue + value 
      });
    }
  }
  
  // Set a gauge value
  gauge(name, value, tags = {}) {
    if (!this.metricsEnabled) return;
    
    const key = this._formatKey(name, tags);
    this.gauges.set(key, value);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Gauge set: ${key}`, { value });
    }
  }
  
  // Record timing in milliseconds
  timing(name, value, tags = {}) {
    if (!this.metricsEnabled) return;
    
    const key = this._formatKey(name, tags);
    const timings = this.timers.get(key) || [];
    timings.push(value);
    this.timers.set(key, timings);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Timing recorded: ${key}`, { 
        value, 
        average: this._calculateAverage(timings) 
      });
    }
  }
  
  // Start a timer and return a function to stop it
  startTimer(name, tags = {}) {
    if (!this.metricsEnabled) return () => {};
    
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.timing(name, duration, tags);
      return duration;
    };
  }
  
  // Format metric key with tags
  _formatKey(name, tags) {
    if (Object.keys(tags).length === 0) {
      return name;
    }
    
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
      
    return `${name}{${tagString}}`;
  }
  
  // Calculate average of an array of values
  _calculateAverage(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  // Get current metrics for debugging or reporting
  getMetrics() {
    const metrics = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      timers: Object.fromEntries(this.timers)
    };
    
    return metrics;
  }
}

// Create and export singleton instance
const metrics = new Metrics();
export default metrics; 