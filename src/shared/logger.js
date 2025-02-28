// Re-export all logging functions from the logging/logger.js file
export * from './logging/logger.js';

// Default export for backward compatibility
import * as loggerFunctions from './logging/logger.js';
export default loggerFunctions; 