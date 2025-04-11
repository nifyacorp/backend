/**
 * Monitoring Index
 * 
 * This file re-exports all monitoring utilities (metrics and tracing) for easier imports
 * throughout the codebase.
 */

// Export metrics utilities
export { 
  increment, 
  timing, 
  gauge, 
  histogram, 
  timeAsync 
} from './metrics.js';

// Export tracing utilities
export { 
  setupTracing, 
  getTracer, 
  withSpan,
  startSubscriptionProcessingSpan,
  startNotificationDeliverySpan
} from './tracing.js';

// For backward compatibility
export const metrics = {
  increment,
  timing,
  gauge,
  histogram,
  timeAsync
};

export const tracing = {
  setupTracing,
  getTracer,
  withSpan,
  startSubscriptionProcessingSpan,
  startNotificationDeliverySpan
};

// Note: Full implementations will be completed in Phase 2 