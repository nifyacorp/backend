import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logger.js';

const app = express();
const db = new DatabaseManager();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Health check endpoint
app.get('/_health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'healthy' });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});