import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';

logger.info('Starting application initialization...');

const app = express();

logger.info('Configuration:', {
  PORT: process.env.PORT || 8080,
  HOST: process.env.HOST || '0.0.0.0'
});

logger.info('Initiating server startup...');

logger.info('Initializing configuration...');
const db = new DatabaseManager();

// Initialize database connection
try {
  logger.info('Running database diagnostics...');
  await db.init();
} catch (error) {
  logger.error('Failed to establish database connection:', error);
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Health check endpoint
app.get('/_health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(StatusCodes.OK).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  logger.info(`Server listening on port ${port}`);
  logger.info('Application startup complete');
});