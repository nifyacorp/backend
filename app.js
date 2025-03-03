const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const socketManager = require('./utils/socket-manager');
const tracing = require('./utils/tracing');

// Import routes
const subscriptionRoutes = require('./routes/subscriptions');
const notificationRoutes = require('./routes/notifications');
const debugRoutes = require('./routes/debug');

// Initialize OpenTelemetry tracing
tracing.setupTracing();

// Create Express app
const app = express();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Custom logging middleware
app.use(logger.addRequestContext);
app.use(logger.logRequest);
app.use(logger.logAuthentication);

// Routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);

// Debug routes (only in non-production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/debug', debugRoutes);
}

// Phase 8: Monitoring and Alerting
// Health check implementation
app.get('/health', async (req, res) => {
  try {
    // Check database
    const db = require('./utils/db');
    const dbHealth = await db.ping();
    
    // Check message queue if configured
    let queueHealth = { status: 'not_configured' };
    if (process.env.USE_MESSAGE_QUEUE === 'true') {
      const messageQueue = require('./utils/message-queue');
      queueHealth = await messageQueue.checkConnection();
    }
    
    // Check cache if configured
    let cacheHealth = { status: 'not_configured' };
    if (process.env.USE_REDIS === 'true') {
      const redisClient = require('./utils/redis-client');
      cacheHealth = await redisClient.ping();
    }
    
    // Compile overall health status
    const systemHealth = {
      status: dbHealth.connected && 
              (queueHealth.status === 'connected' || queueHealth.status === 'not_configured') &&
              (cacheHealth.status === 'connected' || cacheHealth.status === 'not_configured') 
              ? 'healthy' : 'degraded',
      components: {
        database: dbHealth.connected ? 'connected' : 'disconnected',
        messageQueue: queueHealth.status,
        cache: cacheHealth.status
      },
      timestamp: new Date().toISOString()
    };
    
    // Record health status in metrics
    metrics.gauge('health.status', systemHealth.status === 'healthy' ? 1 : 0);
    metrics.gauge('health.database', dbHealth.connected ? 1 : 0);
    if (queueHealth.status === 'connected') metrics.gauge('health.queue', 1);
    if (cacheHealth.status === 'connected') metrics.gauge('health.cache', 1);
    
    res.json(systemHealth);
  } catch (error) {
    logger.error('Health check error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      status: 'error',
      error: error.message
    });
  }
});

// Not found handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Resource not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  logger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  metrics.increment('api.error', {
    status: statusCode,
    path: req.path
  });
  
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
socketManager.initialize(server);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// Handle graceful shutdowns
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Timeout forceful shutdown
  setTimeout(() => {
    logger.error('Forcefully shutting down');
    process.exit(1);
  }, 10000);
});

module.exports = app; 