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

export default {
  logger,
  logRequest, 
  logError, 
  logPubSub, 
  logProcessing, 
  logAuth
}; 