import pkg from 'pg';
import logger from '../utils/logger.js';
import dns from 'dns';
import { promisify } from 'util';

const { Pool } = pkg;
const lookup = promisify(dns.lookup);

async function checkSocketFile(): Promise<void> {
  logger.info('Step 1: Checking Unix socket file...');
  try {
    // Cloud SQL Proxy creates socket in /cloudsql
    const socketPath = '/cloudsql';
    const { access } = await import('fs/promises');
    await access(socketPath);
    logger.info('Socket directory exists and is accessible:', { socketPath });
  } catch (error) {
    logger.error('Socket directory check failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkPoolCreation(): Promise<Pool> {
  logger.info('Step 2: Creating connection pool...');
  try {
    const pool = new Pool({
      ssl: false,
      max: 1, // Single connection for testing
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000
    });
    logger.info('Pool created successfully');
    return pool;
  } catch (error) {
    logger.error('Pool creation failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkClientAcquisition(pool: Pool): Promise<pkg.PoolClient> {
  logger.info('Step 3: Attempting to acquire client from pool...');
  try {
    const startTime = Date.now();
    const client = await pool.connect();
    const duration = Date.now() - startTime;
    logger.info('Client acquired successfully', {
      acquisitionTime: `${duration}ms`
    });
    return client;
  } catch (error) {
    logger.error('Client acquisition failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkBasicQuery(client: pkg.PoolClient): Promise<void> {
  logger.info('Step 4: Testing basic query...');
  try {
    const startTime = Date.now();
    const result = await client.query('SELECT 1 as test');
    const duration = Date.now() - startTime;
    logger.info('Basic query successful:', {
      queryTime: `${duration}ms`,
      result: result.rows[0]
    });
  } catch (error) {
    logger.error('Basic query failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkServerVersion(client: pkg.PoolClient): Promise<void> {
  logger.info('Step 5: Checking server version and connection details...');
  try {
    const startTime = Date.now();
    const result = await client.query(`
      SELECT version(),
             current_database(),
             current_user,
             inet_server_addr() as server_ip,
             inet_server_port() as server_port,
             pg_backend_pid() as backend_pid
    `);
    const duration = Date.now() - startTime;
    logger.info('Server details retrieved:', {
      queryTime: `${duration}ms`,
      version: result.rows[0].version,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      serverIp: result.rows[0].server_ip,
      serverPort: result.rows[0].server_port,
      backendPid: result.rows[0].backend_pid
    });
  } catch (error) {
    logger.error('Server version check failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkDatabaseConnection(): Promise<void> {
  let pool: Pool | undefined;
  let client: pkg.PoolClient | undefined;

  try {
    // Step 1: Check socket file
    await checkSocketFile();

    // Step 2: Create pool
    pool = await checkPoolCreation();

    // Step 3: Acquire client
    client = await checkClientAcquisition(pool);

    // Step 4: Test basic query
    await checkBasicQuery(client);

    // Step 5: Check server version and details
    await checkServerVersion(client);

    logger.info('All database connection checks completed successfully');
  } catch (error) {
    logger.error('Database connection check failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    if (client) {
      logger.info('Releasing test client...');
      client.release();
    }
    if (pool) {
      logger.info('Closing test pool...');
      await pool.end();
    }
  }
}

export async function runDiagnostics(): Promise<void> {
  logger.info('Starting database diagnostics...');
  try {
    await checkDatabaseConnection();
    logger.info('Database diagnostics completed successfully');
  } catch (error) {
    logger.error('Database diagnostics failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}