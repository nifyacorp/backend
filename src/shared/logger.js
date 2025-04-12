/**
 * Centralized logger adapter
 * 
 * This file re-exports the logger functions from the shared/logging/logger.js 
 * to maintain compatibility with legacy imports
 */

import { 
  logger, 
  logRequest, 
  logError, 
  logPubSub, 
  logProcessing, 
  logAuth 
} from './logging/logger.js';

// Export both default object and named exports to support different import styles
export { 
  logger, 
  logRequest, 
  logError, 
  logPubSub, 
  logProcessing, 
  logAuth 
};

// Default export as an object containing all logging functions
export default {
  logger,
  logRequest, 
  logError, 
  logPubSub, 
  logProcessing, 
  logAuth,
  // Add these methods to match direct logger usage
  logInfo: logRequest,
  logDebug: (context, message, data) => logger.debug(message, { ...data, ...context })
}; 