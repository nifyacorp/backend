import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Log database configuration (safely)
console.log('Database Configuration:', {
  hasConnectionString: !!process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
  }
});

// Cloud Run provides database credentials through environment variables
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false // Required for Cloud Run's SSL connection
  }
});

// Add pool error handler
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Add pool connect handler
pool.on('connect', () => {
  console.log('New client connected to database pool');
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    console.log('Attempting database query:', {
      text,
      hasParams: !!params
    });

    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
    throw error;
  }
};