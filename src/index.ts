import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initConfig } from './config/index.js';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/error.js';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';
import { runDiagnostics } from './database/diagnostics.js';

const port = parseInt(process.env.PORT || '8080', 10);
const host = '0.0.0.0';

async function startServer() {
  try {
    const config = await initConfig();
    
    // Run diagnostics before initializing services
    await runDiagnostics();
    
    const app = express();
    const db = new DatabaseManager(config);

    // Initialize database schema
    await db.init();

    // Middleware
    app.use(express.json());
    app.use(cors({
      origin: ['https://nifya.com', 'https://webcontainer.io'],
      credentials: true,
    }));
    app.use(helmet());
    app.use(rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
    }));

    // Health check endpoint
    app.get('/_health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Routes
    app.use('/api/auth', authRoutes);

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(port, host, () => {
      logger.info(`Server listening on ${host}:${port}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      logger.error('Server error:', error);
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
    process.exit(1);
  }
}

startServer();
