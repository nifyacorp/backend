import pkg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pkg;
type PgPool = pkg.Pool;
type PoolClient = pkg.PoolClient;

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

async function checkPoolCreation(): Promise<PgPool> {
  logger.info('Step 2: Creating connection pool...');
  try {
    const socketPath = process.env.DB_SOCKET_PATH || '/cloudsql';
    const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || 'delta-entity-447812-p2:us-central1:delta-entity-447812-db';

    const pool: PgPool = new Pool({
      host: `${socketPath}/${instanceConnectionName}`,
      ssl: false,
      max: 1, // Single connection for testing
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      // Let Cloud Run handle authentication
      user: undefined,
      password: undefined,
      database: undefined
    });
    logger.info('Pool created successfully with Unix socket configuration:', {
      socketPath,
      instanceConnectionName
    });
    return pool;
  } catch (error) {
    logger.error('Pool creation failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function checkClientAcquisition(pool: PgPool): Promise<PoolClient> {
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

async function checkBasicQuery(client: PoolClient): Promise<void> {
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

async function checkServerVersion(client: PoolClient): Promise<void> {
  logger.info('Step 5: Checking server version and connection details...');
  try {
    const startTime = Date.now(); 
    const result = await client.query('SELECT version(), current_database(), current_user, pg_backend_pid() as backend_pid');
    const duration = Date.now() - startTime;
    logger.info('Server details retrieved:', {
      queryTime: `${duration}ms`,
      version: result.rows[0].version,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
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
  let pool: PgPool | undefined;
  let client: PoolClient | undefined;


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