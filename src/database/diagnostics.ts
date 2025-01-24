import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import pkg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pkg;

async function getSecret(name: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/delta-entity-447812-p2/secrets/${name}/versions/latest`,
    });
    return version.payload?.data?.toString() || '';
  } catch (error) {
    logger.error(`Failed to fetch secret: ${name}`, error);
    throw error;
  }
}

async function checkDatabaseConnection(): Promise<void> {
  logger.info('Testing database connection...');
  
  logger.info('Fetching database credentials from Secret Manager...');
  const [dbName, dbUser, dbPassword] = await Promise.all([
    getSecret('DB_NAME'),
    getSecret('DB_USER'),
    getSecret('DB_PASSWORD'),
  ]);
  logger.info('Database credentials retrieved successfully');

  logger.info('Creating test connection pool...');
  const socketPath = '/cloudsql/delta-entity-447812-p2:us-central1:delta-entity-447812-db';

  const pool = new Pool({
    host: socketPath,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: false,
    connectionTimeoutMillis: 20000,
    max: 1,
    idleTimeoutMillis: 5000,
    keepAlive: true
  });
  logger.info('Test pool created, attempting connection:', {
    socketPath,
    database: dbName,
    user: dbUser
  });

  try {
    logger.info('Acquiring client from test pool...');
    const client = await pool.connect();
    logger.info('Successfully acquired client, testing query...');
    const result = await client.query('SELECT version(), pg_postmaster_start_time() as start_time');
    logger.info('Database connection successful:', {
      version: result.rows[0].version,
      serverStartTime: result.rows[0].start_time,
      connectionDetails: {
        database: dbName,
        user: dbUser,
        socketPath,
        connectionType: 'Unix domain socket'
      }
    });
    client.release();
    logger.info('Test client released');
  } catch (error) {
    logger.error('Database connection failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      detail: (error as any)?.detail,
      hint: (error as any)?.hint
    });
    throw error;
  } finally {
    logger.info('Closing test pool...');
    await pool.end();
    logger.info('Test pool closed');
  }
}

export async function runDiagnostics(): Promise<void> {
  try {
    await checkDatabaseConnection();
    logger.info('All diagnostics completed successfully');
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    throw error;
  }
}