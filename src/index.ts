import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initConfig } from './config/index.js';
import { errorHandler } from './middleware/error.js';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';
import { runDiagnostics } from './database/diagnostics.js';

logger.info('Starting application initialization...');

const PORT = 8080;
const HOST = '0.0.0.0';

logger.info('Configuration:', { PORT, HOST });

async function startServer() {
  try {
    logger.info('Initializing configuration...');
    const config = await initConfig();
    logger.info('Configuration initialized successfully');
    
    // Run diagnostics before initializing services
    logger.info('Running database diagnostics...');
    await runDiagnostics();
    logger.info('Database diagnostics completed');
    
    const app = express();
    logger.info('Express application created');

    const db = new DatabaseManager(config);

    // Initialize database schema
    logger.info('Initializing database schema...');
    await db.init();
    logger.info('Database schema initialized');

    // Middleware
    logger.info('Setting up middleware...');
    app.use(express.json());
    app.use(cors({ 
      origin: config.CORS_ORIGIN,
      credentials: true
    }));
    app.use(helmet());
    app.use(rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
    }));
    logger.info('Middleware setup completed');

    // Health check endpoints
    app.get('/_health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        message: 'API server is running'
      });
    });

    // Error handling
    app.use(errorHandler);

    // Start server
    logger.info('Attempting to start server...');
    const server = app.listen(PORT, HOST, () => {
      logger.info('Server startup successful', {
        host: HOST,
        port: PORT,
        pid: process.pid,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      logger.error('Failed to start server:', {
        error: error.message,
        code: error.code,
        syscall: error.syscall,
        address: 'address' in error ? error.address : undefined,
        port: 'port' in error ? error.port : undefined,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        logger.info('Server closed');
        await db.end();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    if (error instanceof Error) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

logger.info('Initiating server startup...');
startServer();
