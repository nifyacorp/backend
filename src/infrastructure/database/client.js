import pg from 'pg';
import dotenv from 'dotenv';
import { AppError } from '../../shared/errors/AppError.js';
import { validateRequiredEnvVars } from '../../shared/utils/env.js';
import { sanitizeSqlForLogging, sanitizeParamsForLogging } from '../../shared/utils/sql-sanitizer.js';
import { logger } from '../../shared/logging/logger.js';

dotenv.config();

// Determine if running in production or development
const isProduction = process.env.NODE_ENV === 'production';
const isLocalDevelopment = !isProduction;

// Skip validation in development mode if specified
if (!(isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true')) {
  // Validate required environment variables
  validateRequiredEnvVars([
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ]);
}

const { Pool } = pg;

// Configure database connection
let dbConfig;

if (isProduction) {
  // Production: Connect to Cloud SQL instance
  dbConfig = {
    host: '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  };
} else {
  // Local development: Connect to local PostgreSQL
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  };
}

// Log database configuration (excluding sensitive data)
logger.info('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  hasUser: !!dbConfig.user,
  hasPassword: !!dbConfig.password,
  environment: isProduction ? 'production' : 'development'
});

// Create database connection pool
export const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  logger.error('Unexpected database error:', {
    message: err.message,
    code: err.code
  });
});

export async function query(text, params) {
  // Skip actual DB operations in development mode if specified
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    logger.info('DEVELOPMENT MODE: Skipping DB query execution', { 
      sql: sanitizeSqlForLogging(text),
      params: sanitizeParamsForLogging(params)
    });
    
    return { rows: [], rowCount: 0 };
  }

  const start = Date.now();
  let client;
  
  logger.info('[DB CLIENT] Attempting query execution', {
    sql: sanitizeSqlForLogging(text),
    params: sanitizeParamsForLogging(params),
    timestamp: new Date().toISOString()
  });
  
  try {
    // Get client from pool
    logger.info('[DB CLIENT] Connecting to pool...', {
      timestamp: new Date().toISOString()
    });
    client = await pool.connect();
    logger.info('[DB CLIENT] Connected to pool successfully', {
      timestamp: new Date().toISOString()
    });
    
    // Execute query
    logger.info('[DB CLIENT] Executing query...', {
      sql: sanitizeSqlForLogging(text),
      params: sanitizeParamsForLogging(params),
      timestamp: new Date().toISOString()
    });
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    // Log query execution with sanitized data
    logger.info('[DB CLIENT] Query executed successfully', { 
      sql: sanitizeSqlForLogging(text),
      params: sanitizeParamsForLogging(params),
      duration,
      rowCount: res.rowCount,
      timestamp: new Date().toISOString()
    });
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Log error with sanitized data and FULL error object
    logger.error('[DB CLIENT] Database query error', {
      sql: sanitizeSqlForLogging(text),
      params: sanitizeParamsForLogging(params),
      duration,
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        stack: error.stack,
        errno: error.errno,
        syscall: error.syscall
      },
      fullErrorObject: error,
      timestamp: new Date().toISOString()
    });
    
    throw new AppError(
      'DATABASE_ERROR',
      `Database operation failed: ${error.message}`,
      500,
      { 
        originalError: error.message,
        code: error.code,
        detail: error.detail
      }
    );
  } finally {
    if (client) {
      logger.info('[DB CLIENT] Releasing client...', {
        timestamp: new Date().toISOString()
      });
      try {
        client.release();
        logger.info('[DB CLIENT] Client released successfully', {
          timestamp: new Date().toISOString()
        });
      } catch (releaseError) {
        logger.error('[DB CLIENT] Error releasing database connection', {
          error: releaseError.message,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      logger.info('[DB CLIENT] No client to release.', {
        timestamp: new Date().toISOString()
      });
    }
  }
}

export async function initializeDatabase() {
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    logger.info('Running in local development mode with SKIP_DB_VALIDATION - skipping database initialization');
    return;
  }
  
  // Connection retry parameters
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 3000; // 3 seconds
  
  // Function to retry database connection
  async function attemptDatabaseConnection(retryCount = 0) {
    try {
      logger.info(`Database connection attempt ${retryCount + 1}/${MAX_RETRIES}...`);
      const result = await query('SELECT current_database() as db_name');
      logger.info('Database connection verified:', {
        database: result.rows[0].db_name,
        poolSize: pool.totalCount
      });
      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES - 1) {
        logger.warn(`Connection failed, retrying in ${RETRY_DELAY_MS}ms...`, {
          error: error.message,
          attempt: retryCount + 1
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return attemptDatabaseConnection(retryCount + 1);
      } else {
        logger.error('Maximum connection retry attempts reached');
        throw error;
      }
    }
  }
  
  try {
    // Verify connection with retry
    await attemptDatabaseConnection();
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw new AppError(
      'DATABASE_INIT_ERROR',
      'Failed to initialize database',
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Sets the RLS context for the current database session
 * @param {string} userId - The user ID to set in the RLS context
 * @returns {Promise<void>}
 */
export async function setRLSContext(userId) {
  if (!userId) {
    logger.warn('Attempted to set RLS context without a user ID');
    return;
  }
  
  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    logger.info('DEVELOPMENT MODE: Skipping RLS context setting');
    return;
  }
  
  // Validate that userId is a valid ID format (UUID or Firebase UID) to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const firebaseUidRegex = /^[A-Za-z0-9]{20,28}$/;
  if (!uuidRegex.test(userId) && !firebaseUidRegex.test(userId)) {
    logger.error('Invalid ID format for RLS context', { userId });
    throw new Error('Invalid ID format for user ID');
  }
  
  try {
    // Use a string literal instead of parameterized query for SET LOCAL
    await query(`SET LOCAL app.current_user_id = '${userId}'`, []);
    logger.info('Set RLS context successfully:', {
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to set RLS context:', {
      error: error.message,
      userId,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Database operation failed: ${error.message}`);
  }
}

/**
 * Executes a callback function with the RLS context set for a specific user
 * @param {string} userId - The user ID to set in the RLS context
 * @param {Function} callback - The function to execute within the RLS context
 * @returns {Promise<any>} - The result of the callback function
 */
export async function withRLSContext(userId, callback) {
  if (!userId) {
    throw new Error('User ID is required for RLS context');
  }
  
  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    logger.info('DEVELOPMENT MODE: Skipping RLS context for callback execution');
    return await callback({ query: async (text, params) => ({ rows: [], rowCount: 0 }) });
  }
  
  // Validate that userId is a valid ID format (UUID or Firebase UID) to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const firebaseUidRegex = /^[A-Za-z0-9]{20,28}$/;
  if (!uuidRegex.test(userId) && !firebaseUidRegex.test(userId)) {
    throw new Error('Invalid ID format for user ID');
  }
  
  const client = await pool.connect();
  try {
    // Use a string literal instead of parameterized query for SET LOCAL
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`, []);
    return await callback(client);
  } finally {
    client.release();
  }
}

/**
 * Executes a callback function within a database transaction with RLS context set
 * This ensures atomicity for complex database operations
 * 
 * @param {string} userId - The user ID to set in the RLS context
 * @param {Function} callback - The function to execute within the transaction
 * @param {Object} [options] - Options for the transaction
 * @param {Object} [options.logger] - Logger to use for logging transaction details 
 * @param {string} [options.context] - Context information for logging
 * @param {string} [options.isolationLevel] - Transaction isolation level (READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
 * @returns {Promise<any>} - The result of the callback function
 */
export async function withTransaction(userId, callback, options = {}) {
  const { logger, context, isolationLevel = 'READ COMMITTED' } = options;
  const log = (level, message, details = {}) => {
    if (logger && logger[level]) {
      logger[level](context, message, details);
    } else {
      console[level === 'error' ? 'error' : 'log'](`Transaction ${message}:`, {
        userId,
        ...details,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    log('info', 'Skipping transaction in development mode');
    return await callback({ 
      query: async (text, params) => ({ rows: [], rowCount: 0 }),
      isInTransaction: true
    });
  }
  
  // Validate that userId is a valid ID format (UUID or Firebase UID) to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const firebaseUidRegex = /^[A-Za-z0-9]{20,28}$/;
  if (userId && !uuidRegex.test(userId) && !firebaseUidRegex.test(userId)) {
    throw new Error('Invalid ID format for user ID');
  }
  
  // Validate isolation level
  const validIsolationLevels = ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
  if (!validIsolationLevels.includes(isolationLevel)) {
    log('info', `Invalid isolation level "${isolationLevel}", using default "READ COMMITTED"`);
    options.isolationLevel = 'READ COMMITTED';
  }
  
  const client = await pool.connect();
  
  try {
    log('info', `Starting transaction with isolation level ${isolationLevel}`);
    await client.query('BEGIN');
    
    // Set transaction isolation level
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    
    // Set RLS context if userId is provided
    if (userId) {
      await client.query(`SET LOCAL app.current_user_id = '${userId}'`, []);
      log('info', 'Set RLS context for transaction');
    }
    
    // Create a transaction client object containing the bound query method
    const txClient = {
      query: client.query.bind(client), // Explicitly pass the bound query method
      isInTransaction: true,
      isolationLevel
      // Add other client properties if needed by callbacks, e.g., client.escapeIdentifier
    };
    
    // Execute the callback within the transaction
    const result = await callback(txClient);
    
    // Only commit if the client hasn't already committed - this allows for explicit commits
    if (!client.connection._ending) {
      await client.query('COMMIT');
      log('info', 'Transaction committed successfully');
    } else {
      log('info', 'Transaction already committed by client');
    }
    
    return result;
  } catch (error) {
    try {
      // Only rollback if the client hasn't already committed/rolled back
      if (!client.connection._ending) {
        await client.query('ROLLBACK');
        log('error', 'Transaction rolled back due to error', {
          error: error.message,
          code: error.code,
          detail: error.detail
        });
      } else {
        log('info', 'Transaction already ended - skipping rollback');
      }
    } catch (rollbackError) {
      log('error', 'Failed to rollback transaction', {
        error: rollbackError.message,
        originalError: error.message
      });
    }
    
    // Rethrow the original error
    throw error;
  } finally {
    // Only release if the client is still available
    if (client.connection && !client.connection._ending) {
      client.release();
      log('info', 'Transaction client released');
    } else {
      log('info', 'Client already released/closed');
    }
  }
}