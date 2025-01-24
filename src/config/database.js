import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Log database configuration attempt
console.log('🔌 Attempting database connection with config:', {
  socketPath: process.env.DB_SOCKET_PATH || '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
  database: process.env.DB_NAME,
  hasUser: !!process.env.DB_USER,
  hasPassword: !!process.env.DB_PASSWORD
});

// Log all environment variables (excluding sensitive data)
console.log('📝 Environment variables check:', {
  DB_NAME_SET: !!process.env.DB_NAME,
  DB_USER_SET: !!process.env.DB_USER,
  DB_PASSWORD_SET: !!process.env.DB_PASSWORD,
  NODE_ENV: process.env.NODE_ENV
});

// Create connection pool
const pool = new Pool({
  host: '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // No SSL needed for Unix socket connection
  ssl: false
});


// Add pool error handler
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

// Add pool connect handler
pool.on('connect', () => {
  console.log('✅ New client connected to database pool');
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    console.log('Attempting database query:', {
      text,
      hasParams: !!params,
      timestamp: new Date().toISOString()
    });

    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Query successful:', { 
      text, 
      duration: `${duration}ms`,
      rowCount: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('❌ Database query error:', {
      error: error.message,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      query: text,
      timestamp: new Date().toISOString(),
      constraint: error.constraint
    });
    throw error;
  }
};