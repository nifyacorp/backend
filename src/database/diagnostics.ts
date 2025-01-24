import pkg from 'pg';
import logger from '../utils/logger.js';
import { getConfig } from '../config/index.js';

const { Pool } = pkg;

async function checkDatabaseConnection(): Promise<void> {
  logger.info('Testing database connection...');
  
  const config = await getConfig();
  const pool = new Pool({
    // Cloud Run automatically handles the connection when the Cloud SQL instance is mounted
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    logger.info('Database connection successful:', {
      version: result.rows[0].version
    });
    client.release();
  } catch (error) {
    logger.error('Database connection failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    await pool.end();
  }
}

export async function runDiagnostics(): Promise<void> {
  try {
    await checkDatabaseConnection();
    logger.info('Database diagnostics completed successfully');
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    throw error;
  }
}