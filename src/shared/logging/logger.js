/**
 * Unified Logging System
 * 
 * Combines the best features from both legacy and modern logging implementations:
 * - Winston logger for structured logging and multiple transports
 * - Simple console-based logging with emojis for readability
 * - GitHub issue creation for error reporting
 * - Request context tracking
 */

import winston from 'winston';
import { format } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { createGithubIssue } from '../github/issue-creator.js';

// Create Winston logger configuration
const createWinstonLogger = () => {
  // Define base format for SQL queries
  const sqlBaseFormat = format.printf(({ level, message, sql, params, duration, rowCount, timestamp, ...metadata }) => {
    if (sql) {
      const formattedSql = sql.replace(/\s+/g, ' ').trim();
      const paramInfo = params ? `[${params.join(', ')}]` : 'no params';
      return `${timestamp} ${level}: ${message} - SQL: ${formattedSql} - PARAMS: ${paramInfo} - DURATION: ${duration}ms - ROWS: ${rowCount}`;
    }
    
    let metaStr = '';
    if (Object.keys(metadata).length > 0) {
      metaStr = JSON.stringify(metadata);
    }
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  });

  // Define formats with proper composition
  const sqlFormat = format.combine(
    format.timestamp(),
    sqlBaseFormat
  );

  const consoleFormat = format.combine(
    format.timestamp(),
    format.colorize(),
    format((info) => {
      if (info.sql) {
        // Use SQL format for SQL queries
        return sqlBaseFormat.transform(info);
      }
      // Use default format for non-SQL logs
      return info;
    })(),
    format.printf(({ level, message, timestamp, ...metadata }) => {
      let metaStr = '';
      if (Object.keys(metadata).length > 0 && !metadata.sql) {
        metaStr = JSON.stringify(metadata);
      }
      return `${timestamp} ${level}: ${message} ${metaStr}`;
    })
  );

  const jsonFormat = format.combine(
    format.timestamp(),
    format.json()
  );

  // Define transports
  const transports = [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'debug',
      format: consoleFormat
    })
  ];

  // Add file transports in non-local environments
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'local') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: jsonFormat
      }),
      new winston.transports.File({
        filename: 'logs/sql.log',
        level: 'debug',
        format: sqlFormat,
        filter: (info) => info.sql !== undefined
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: jsonFormat
      })
    );
  }

  // Create logger with default metadata
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
    defaultMeta: {
      service: 'backend-service',
      environment: process.env.NODE_ENV || 'development'
    },
    transports
  });
};

// Create the Winston logger instance
const winstonLogger = createWinstonLogger();

/**
 * Log a request with emoji formatting
 * @param {Object} context - Request context (requestId, path)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export function logRequest(context = {}, message, data = {}) {
  // Format with emoji for console
  console.log(`📝 ${message}:`, {
    ...data,
    requestId: context.requestId || 'unknown',
    path: context.path || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Also log with Winston
  winstonLogger.info(message, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    type: 'request'
  });
}

/**
 * Log an error with GitHub issue creation
 * @param {Object} context - Request context (requestId, path)
 * @param {Error|Object} error - Error object or error data
 * @param {Object} additionalData - Additional context for the error
 */
export function logError(context = {}, error, additionalData = {}) {
  // Check if error is already a plain object with an 'error' property
  if (error && typeof error === 'object' && !error.message && error.error) {
    console.error('❌ Error:', {
      error: error.error,
      subscription_id: error.subscription_id,
      ...additionalData,
      requestId: context.requestId || 'unknown',
      path: context.path || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Log with Winston
    winstonLogger.error(error.error, {
      subscription_id: error.subscription_id,
      ...additionalData,
      requestId: context.requestId,
      path: context.path,
      type: 'error'
    });
  } else {
    console.error('❌ Error:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      ...additionalData,
      requestId: context.requestId || 'unknown',
      path: context.path || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Log with Winston
    winstonLogger.error(error.message || 'Unknown error', {
      code: error.code,
      stack: error.stack,
      ...additionalData,
      requestId: context.requestId,
      path: context.path,
      type: 'error'
    });
  }

  // GitHub Issue Creation (non-blocking)
  if (process.env.ENABLE_GITHUB_ISSUE_REPORTING === 'true') {
    const combinedContext = {
      ...(context || {}),
      ...(additionalData || {})
    };
    
    // Use setImmediate to avoid blocking
    setImmediate(() => {
      try {
        // Ensure we pass a proper Error object
        const errorToReport = (error instanceof Error) 
          ? error 
          : new Error(JSON.stringify(error || 'Unknown Error'));
        createGithubIssue(errorToReport, combinedContext);
      } catch (githubErr) {
        console.error('Error invoking createGithubIssue:', githubErr);
      }
    });
  }
}

/**
 * Log a PubSub operation
 * @param {Object} context - Request context (requestId, path)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export function logPubSub(context = {}, message, data = {}) {
  console.log(`📨 ${message}:`, {
    ...data,
    requestId: context.requestId || 'unknown',
    path: context.path || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Also log with Winston
  winstonLogger.info(message, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    type: 'pubsub'
  });
}

/**
 * Log a processing operation
 * @param {Object} context - Request context (requestId, path)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export function logProcessing(context = {}, message, data = {}) {
  console.log(`⚙️ ${message}:`, {
    ...data,
    requestId: context.requestId || 'unknown',
    path: context.path || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Also log with Winston
  winstonLogger.info(message, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    type: 'processing'
  });
}

/**
 * Log an authentication operation
 * @param {Object} context - Request context (requestId, path)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export function logAuth(context = {}, message, data = {}) {
  console.log(`🔒 ${message}:`, {
    ...data,
    requestId: context.requestId || 'unknown',
    path: context.path || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Also log with Winston
  winstonLogger.info(message, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    type: 'auth'
  });
}

/**
 * Create request context middleware for Express/Fastify
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export function addRequestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Create a request context
  req.context = {
    requestId,
    path: req.path || req.url,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get ? req.get('user-agent') : req.headers['user-agent'],
    timestamp: new Date().toISOString()
  };
  
  // Add child logger
  req.logger = {
    info: (message, data) => logRequest(req.context, message, data),
    error: (error, data) => logError(req.context, error, data),
    warn: (message, data) => winstonLogger.warn(message, { ...data, ...req.context }),
    debug: (message, data) => winstonLogger.debug(message, { ...data, ...req.context })
  };
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Continue with request
  next();
}

/**
 * Request logging middleware
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export function requestLogger(req, res, next) {
  // Ensure we have context and logger
  if (!req.context) {
    addRequestContext(req, res, () => {});
  }
  
  const startTime = process.hrtime();
  
  // Log request start
  logRequest(req.context, `Request started: ${req.method} ${req.url}`, {
    body: req.method !== 'GET' ? req.body : undefined
  });
  
  // Log response on finish
  res.on('finish', () => {
    const hrtime = process.hrtime(startTime);
    const responseTimeMs = hrtime[0] * 1000 + hrtime[1] / 1000000;
    
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
    
    // Use appropriate log level based on status
    winstonLogger[logLevel](`Request completed: ${req.method} ${req.url}`, {
      statusCode: res.statusCode,
      responseTimeMs,
      requestId: req.context.requestId,
      path: req.context.path
    });
  });
  
  next();
}

// Export Winston logger for direct use where needed
export const logger = winstonLogger;