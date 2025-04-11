/**
 * Event Emitter Service
 * 
 * Provides a central event bus for internal application events.
 * Used for loose coupling between components.
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/logging/logger.js';

// Set maximum number of listeners to avoid memory leaks
const MAX_LISTENERS = 50;

class ApplicationEventEmitter extends EventEmitter {
  constructor() {
    super();
    
    // Set higher max listeners to accommodate our application needs
    this.setMaxListeners(MAX_LISTENERS);
    
    // Event registry for documentation and debugging
    this.eventRegistry = new Map();
    
    // Debug mode for development
    this.debugMode = process.env.NODE_ENV !== 'production';
    
    logger.info('Event emitter service initialized', {
      maxListeners: MAX_LISTENERS,
      debugMode: this.debugMode
    });
  }
  
  // Register an event type for documentation and validation
  registerEvent(eventName, description, schema = null) {
    this.eventRegistry.set(eventName, {
      description,
      schema,
      listeners: 0
    });
    
    logger.debug(`Event type registered: ${eventName}`, {
      description,
      hasSchema: !!schema
    });
    
    return this;
  }
  
  // Enhanced emit with logging and validation
  emit(eventName, payload) {
    if (this.debugMode) {
      // In debug mode, log all events
      logger.debug(`Event emitted: ${eventName}`, {
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload) : []
      });
      
      // Validate if event is registered
      if (!this.eventRegistry.has(eventName)) {
        logger.warn(`Unregistered event emitted: ${eventName}`);
      }
    }
    
    return super.emit(eventName, payload);
  }
  
  // Enhanced on with listener tracking
  on(eventName, listener) {
    super.on(eventName, listener);
    
    // Update registry if event is registered
    if (this.eventRegistry.has(eventName)) {
      const eventInfo = this.eventRegistry.get(eventName);
      eventInfo.listeners += 1;
      this.eventRegistry.set(eventName, eventInfo);
    }
    
    if (this.debugMode) {
      logger.debug(`Event listener added for: ${eventName}`, {
        totalListeners: this.listenerCount(eventName)
      });
    }
    
    return this;
  }
  
  // Enhanced removeListener with tracking
  removeListener(eventName, listener) {
    super.removeListener(eventName, listener);
    
    // Update registry if event is registered
    if (this.eventRegistry.has(eventName)) {
      const eventInfo = this.eventRegistry.get(eventName);
      eventInfo.listeners = Math.max(0, eventInfo.listeners - 1);
      this.eventRegistry.set(eventName, eventInfo);
    }
    
    if (this.debugMode) {
      logger.debug(`Event listener removed for: ${eventName}`, {
        totalListeners: this.listenerCount(eventName)
      });
    }
    
    return this;
  }
  
  // Get information about registered events for debugging
  getEventInfo() {
    const result = {};
    
    this.eventRegistry.forEach((info, eventName) => {
      result[eventName] = {
        ...info,
        actualListeners: this.listenerCount(eventName)
      };
    });
    
    return result;
  }
}

// Create and export singleton instance
const eventEmitter = new ApplicationEventEmitter();

// Register common application events
eventEmitter.registerEvent('user:created', 'User account created');
eventEmitter.registerEvent('user:updated', 'User profile updated');
eventEmitter.registerEvent('subscription:created', 'New subscription created');
eventEmitter.registerEvent('subscription:updated', 'Subscription updated');
eventEmitter.registerEvent('subscription:deleted', 'Subscription deleted');
eventEmitter.registerEvent('notification:created', 'New notification created');
eventEmitter.registerEvent('notification:read', 'Notification marked as read');
eventEmitter.registerEvent('notification:deleted', 'Notification deleted');

export default eventEmitter; 