import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initConfig } from './config/index.js';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/error.js';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';

async function startServer() {
  try {
    const config = await initConfig();
    const app = express();
    const db = new DatabaseManager(config);

    // Initialize database
    await db.init();

    // Middleware
    app.use(express.json());
    app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }));
    app.use(helmet());
    app.use(rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
    }));

    // Routes
    app.use('/api/auth', authRoutes);

    // Error handling
    app.use(errorHandler);

    // Start server
    const port = config.PORT;
    app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
