import pg from 'pg';
import dotenv from 'dotenv';
import { AppError } from '../../shared/errors/AppError.js';
import { validateRequiredEnvVars } from '../../shared/utils/env.js';
import { initializeMigrations } from './migrations.js';

dotenv.config();

// Validate required environment variables
validateRequiredEnvVars([
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
]);

const { Pool } = pg;

// Determine if running in production or development
const isProduction = process.env.NODE_ENV === 'production';
const isLocalDevelopment = !isProduction;

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
console.log('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  hasUser: !!dbConfig.user,
  hasPassword: !!dbConfig.password,
  environment: isProduction ? 'production' : 'development',
  timestamp: new Date().toISOString()
});

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected database error:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });
});

export async function query(text, params) {
  const start = Date.now();
  let client;
  
  try {
    // Get client from pool
    client = await pool.connect();
    
    console.log('Database connection obtained for query:', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      paramCount: params ? params.length : 0,
      timestamp: new Date().toISOString()
    });
    
    // Execute query
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    console.log('Query executed successfully:', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rowCount: res.rowCount,
      timestamp: new Date().toISOString()
    });
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      params: params ? `${params.length} parameters` : 'no parameters',
      duration: `${duration}ms`,
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
    // Release client back to pool
    if (client) {
      try {
        client.release();
        console.log('Database connection released', {
          timestamp: new Date().toISOString()
        });
      } catch (releaseError) {
        console.error('Error releasing database connection', {
          error: releaseError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

export async function initializeDatabase() {
  if (isLocalDevelopment) {
    console.log('Running in local development mode - skipping database initialization');
    return;
  }
  
  try {
    // First verify connection
    const result = await query('SELECT current_database() as db_name');
    console.log('Database connection verified:', {
      database: result.rows[0].db_name,
      poolSize: pool.totalCount,
      timestamp: new Date().toISOString()
    });

    // Then run migrations
    await initializeMigrations();
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
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
    console.warn('Attempted to set RLS context without a user ID');
    return;
  }
  
  // Validate that userId is a valid UUID to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('Invalid UUID format for RLS context', { userId });
    throw new Error('Invalid UUID format for user ID');
  }
  
  try {
    // Use a string literal instead of parameterized query for SET LOCAL
    await query(`SET LOCAL app.current_user_id = '${userId}'`, []);
    console.log('Set RLS context successfully:', {
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to set RLS context:', {
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
  
  // Validate that userId is a valid UUID to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('Invalid UUID format for user ID');
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