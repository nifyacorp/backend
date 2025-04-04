const winston = require('winston');
const { format } = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

// Create a default logger configuration
const createLogger = () => {
  // Define log formats
  const consoleFormat = format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf(({ level, message, timestamp, ...metadata }) => {
      let metaStr = '';
      if (Object.keys(metadata).length > 0) {
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
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormat
    })
  ];

  // Add Elasticsearch transport in non-local environments if configured
  if (process.env.ELASTICSEARCH_URL && process.env.NODE_ENV !== 'local') {
    const esTransport = new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: process.env.ELASTICSEARCH_AUTH ? {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD
        } : undefined
      },
      indexPrefix: 'subscription-service'
    });
    
    transports.push(esTransport);
  }

  // Create logger
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: jsonFormat,
    defaultMeta: {
      service: 'subscription-service',
      environment: process.env.NODE_ENV || 'development'
    },
    transports
  });
};

// Create the logger instance
const logger = createLogger();

// Add request context for tracing
const addRequestContext = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || require('uuid').v4();
  
  // Create a request-specific child logger
  req.logger = logger.child({
    requestId,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('user-agent')
  });
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

// Utility to log the start of an HTTP request
const logRequest = (req, res, next) => {
  if (!req.logger) {
    // If middleware wasn't applied, use the default logger
    req.logger = logger;
  }
  
  const startHrTime = process.hrtime();
  
  req.logger.debug('Request started', {
    requestBody: req.method !== 'GET' ? req.body : undefined
  });
  
  // Log when the request completes
  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
    
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'debug';
    
    req.logger[logLevel]('Request completed', {
      statusCode: res.statusCode,
      responseTimeMs: elapsedTimeInMs
    });
  });
  
  next();
};

// Custom middleware for authentication logging
const logAuthentication = (req, res, next) => {
  if (req.user) {
    if (!req.logger) {
      req.logger = logger;
    }
    
    // Add user context to the logger
    req.logger = req.logger.child({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role
    });
  }
  
  next();
};

module.exports = logger;
module.exports.addRequestContext = addRequestContext;
module.exports.logRequest = logRequest;
module.exports.logAuthentication = logAuthentication; 