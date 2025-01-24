import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Log database configuration attempt
console.log('🔌 Attempting database connection with config:', {
  socketPath: '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
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
  socketPath: '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
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

export async function initializeDatabase() {
  try {
    console.log('🔄 Starting database initialization check...', {
      timestamp: new Date().toISOString(),
      migrationPath: path.join(__dirname, '../../supabase/migrations/20250124170000_remove_auth_dependency.sql')
    });
    
    // Check if tables exist
    console.log('🔍 Checking if tables exist...');
    const tablesExist = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tablesExist.rows[0].exists) {
      console.log('📦 Tables not found, starting migration...', {
        exists: tablesExist.rows[0].exists,
        timestamp: new Date().toISOString()
      });
      
      // Read and execute migration SQL
      const migrationPath = path.join(__dirname, '../../supabase/migrations/20250124170000_remove_auth_dependency.sql');
      console.log('📄 Reading migration file...', {
        migrationPath,
        fileExists: fs.existsSync(migrationPath)
      });
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('📝 Migration file read successfully', {
        contentLength: migrationSQL.length,
        firstLine: migrationSQL.split('\n')[0]
      });
      
      console.log('⚡ Executing migration SQL...');
      await query(migrationSQL);
      console.log('✅ Database tables created successfully', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('✅ Database tables already exist', {
        timestamp: new Date().toISOString()
      });
    }

    // Verify tables after initialization
    console.log('🔍 Verifying database tables...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📊 Database tables verification:', {
      tableCount: tables.rows.length,
      tables: tables.rows.map(row => row.table_name),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to initialize database:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      details: {
        code: error.code,
        position: error.position,
        hint: error.hint,
        where: error.where
      }
    });
    throw error;
  }
}

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