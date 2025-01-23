import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initConfig } from './config/index.js';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/error.js';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || '8080';

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
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
