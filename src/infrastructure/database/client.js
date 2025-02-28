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
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('Query executed:', { 
      text,
      duration: `${duration}ms`,
      rowCount: res.rowCount,
      timestamp: new Date().toISOString()
    });
    
    return res;
  } catch (error) {
    console.error('Database query error:', {
      error: error.message,
      query: text,
      timestamp: new Date().toISOString()
    });
    
    throw new AppError(
      'DATABASE_ERROR',
      'Database operation failed',
      500,
      { originalError: error.message }
    );
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