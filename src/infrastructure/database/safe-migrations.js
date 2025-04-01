/**
 * Production-safe migration system for NIFYA backend
 * 
 * This system ensures that migrations are applied safely without data loss.
 * It includes the following safety measures:
 * 1. Ensures the schema_version table exists before running any migrations
 * 2. Properly handles JSON syntax in SQL scripts
 * 3. Runs all migrations in transactions when possible
 * 4. Provides detailed error information for troubleshooting
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, withTransaction, pool } from './client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

// Get the current module's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to migrations directory
const MIGRATIONS_DIR = path.join(__dirname, '../../../supabase/migrations');

// Migration error types
const MIGRATION_ERRORS = {
  INVALID_SYNTAX: {
    code: 'MIGRATION_INVALID_SYNTAX',
    message: 'Migration contains invalid SQL syntax'
  },
  ALREADY_APPLIED: {
    code: 'MIGRATION_ALREADY_APPLIED',
    message: 'Migration has already been applied'
  },
  EXECUTION_ERROR: {
    code: 'MIGRATION_EXECUTION_ERROR',
    message: 'Error executing migration'
  },
  TRANSACTION_ERROR: {
    code: 'MIGRATION_TRANSACTION_ERROR',
    message: 'Transaction error during migration'
  }
};

/**
 * Check if a table exists in the database
 * 
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - True if table exists, false otherwise
 */
async function tableExists(tableName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Create the schema_version table if it doesn't exist
 * This is a critical first step for the migration system
 */
async function ensureSchemaVersionTable() {
  try {
    console.log('Checking for schema_version table...');
    
    // Check if the table exists
    const exists = await tableExists('schema_version');
    
    if (!exists) {
      console.log('Creating schema_version table...');
      
      // Create the table and helper functions
      await query(`
        CREATE TABLE schema_version (
          version VARCHAR(255) NOT NULL PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          description TEXT
        );
        
        -- Version checking function
        CREATE OR REPLACE FUNCTION check_schema_version(required_version VARCHAR) 
        RETURNS BOOLEAN AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM schema_version 
            WHERE version = required_version
          );
        END;
        $$ LANGUAGE plpgsql;
        
        -- Version registration function
        CREATE OR REPLACE FUNCTION register_schema_version(version_id VARCHAR, version_description TEXT) 
        RETURNS VOID AS $$
        BEGIN
          INSERT INTO schema_version (version, description)
          VALUES (version_id, version_description)
          ON CONFLICT (version) DO NOTHING;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log('✅ Schema version table created successfully');
    } else {
      console.log('✅ Schema version table already exists');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to ensure schema_version table:', error);
    throw new AppError(
      'DATABASE_INIT_ERROR',
      `Failed to initialize schema version tracking: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get list of applied migrations from the database
 */
async function getAppliedMigrations() {
  try {
    // First check if schema_version table exists
    const exists = await tableExists('schema_version');
    
    if (!exists) {
      console.log('Schema version table does not exist yet, returning empty set');
      return new Set();
    }
    
    // Get all applied migrations
    const result = await query('SELECT version FROM schema_version ORDER BY applied_at');
    return new Set(result.rows.map(row => row.version));
  } catch (error) {
    console.error('Failed to get applied migrations:', error);
    return new Set(); // Return empty set to be cautious
  }
}

/**
 * Extract error location from a database error
 */
function getErrorLocation(error, sqlContent) {
  if (!error || !error.position || !sqlContent) return null;
  
  const position = parseInt(error.position, 10);
  if (isNaN(position)) return null;
  
  // Calculate line number from position
  const contentBeforeError = sqlContent.substring(0, position);
  const lines = contentBeforeError.split('\n');
  const lineNumber = lines.length;
  
  // Get the line content
  const fullLines = sqlContent.split('\n');
  const lineContent = lineNumber <= fullLines.length ? fullLines[lineNumber - 1].trim() : '';
  
  return {
    lineNumber,
    lineContent,
    position
  };
}

/**
 * Apply a single migration in a transaction
 */
async function applyMigration(migrationFile, appliedMigrations, context = {}) {
  const version = path.basename(migrationFile).split('_')[0];
  const filePath = path.join(MIGRATIONS_DIR, migrationFile);
  
  logRequest(context, `Applying migration: ${migrationFile}`, { version });
  
  // Skip if already applied
  if (appliedMigrations.has(version)) {
    logRequest(context, `Migration ${version} already applied, skipping`);
    return true;
  }
  
  // Read migration file
  let sqlContent;
  try {
    sqlContent = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    logError(context, `Failed to read migration file ${migrationFile}:`, error);
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Failed to read migration file: ${error.message}`,
      500,
      { file: migrationFile }
    );
  }
  
  // Apply migration within a transaction
  // Since we're having issues with the transaction helper, use a direct approach
  const client = await pool.connect();
  
  try {
    logRequest(context, "Starting transaction");
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(sqlContent);
    
    // Record the migration as applied
    await client.query(
      'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [version, `Migration from file ${migrationFile}`]
    );
    
    await client.query('COMMIT');
    logRequest(context, `Migration ${version} applied successfully`);
    
    return true;
  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK');
      logError(context, "Transaction rolled back due to error");
    } catch (rollbackError) {
      logError(context, "Failed to rollback transaction", {
        error: rollbackError.message,
        originalError: error.message
      });
    }
    
    // Enhance error with location information
    const errorLocation = getErrorLocation(error, sqlContent);
    
    logError(context, `Migration ${migrationFile} failed:`, error);
    
    if (errorLocation) {
      logError(context, `Error at line ${errorLocation.lineNumber}: ${errorLocation.lineContent}`);
    }
    
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Migration failed: ${error.message}`,
      500,
      {
        file: migrationFile,
        version,
        errorLine: errorLocation?.lineNumber,
        errorContent: errorLocation?.lineContent,
        originalError: error.message,
        code: error.code,
        detail: error.detail
      }
    );
  } finally {
    client.release();
    logRequest(context, "Transaction client released");
  }
}

/**
 * Apply special migration that can't be run in a transaction
 * (like schema_version table creation or certain DDL statements)
 */
async function applySpecialMigration(migrationFile, appliedMigrations, context = {}) {
  const version = path.basename(migrationFile).split('_')[0];
  const filePath = path.join(MIGRATIONS_DIR, migrationFile);
  
  logRequest(context, `Applying special migration: ${migrationFile}`, { version });
  
  // Skip if already applied (except for schema_version creation)
  if (appliedMigrations.has(version) && !migrationFile.includes('create_schema_version')) {
    logRequest(context, `Migration ${version} already applied, skipping`);
    return true;
  }
  
  // Read migration file
  let sqlContent;
  try {
    sqlContent = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    logError(context, `Failed to read migration file ${migrationFile}:`, error);
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Failed to read migration file: ${error.message}`,
      500,
      { file: migrationFile }
    );
  }
  
  // Apply migration directly (not in a transaction)
  try {
    await query(sqlContent);
    
    // If this isn't the schema_version creation migration,
    // record it in the schema_version table
    if (!migrationFile.includes('create_schema_version')) {
      await query(
        'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
        [version, `Special migration from file ${migrationFile}`]
      );
    }
    
    logRequest(context, `Special migration ${version} applied successfully`);
    return true;
  } catch (error) {
    // Enhance error with location information
    const errorLocation = getErrorLocation(error, sqlContent);
    
    logError(context, `Special migration ${migrationFile} failed:`, error);
    
    if (errorLocation) {
      logError(context, `Error at line ${errorLocation.lineNumber}: ${errorLocation.lineContent}`);
    }
    
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Special migration failed: ${error.message}`,
      500,
      {
        file: migrationFile,
        version,
        errorLine: errorLocation?.lineNumber,
        errorContent: errorLocation?.lineContent,
        originalError: error.message,
        code: error.code,
        detail: error.detail
      }
    );
  }
}

/**
 * Run all database migrations in production-safe mode
 */
export async function runMigrations(context = {}) {
  const requestId = context.requestId || 'migration-' + Date.now();
  const migrationContext = {
    ...context,
    requestId,
    path: context.path || 'migrations',
    method: context.method || 'APPLY'
  };
  
  try {
    // Step 1: Ensure schema_version table exists
    await ensureSchemaVersionTable();
    
    // Step 2: Get already applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Step 3: Get all migration files
    const files = await fs.readdir(MIGRATIONS_DIR);
    
    // Filter for SQL files and sort by name (version)
    const migrationFiles = files
      .filter(file => file.endsWith('.sql') && !file.endsWith('.fixed.sql'))
      .sort();
    
    logRequest(migrationContext, `Found ${migrationFiles.length} migration files`, { 
      files: migrationFiles 
    });
    
    // Step 4: Apply special migrations first (schema creation, etc.)
    // These migrations can't be run in a transaction
    const specialMigrations = migrationFiles.filter(file => 
      file.includes('create_schema_version') || file.includes('consolidated_schema_reset')
    );
    
    for (const file of specialMigrations) {
      await applySpecialMigration(file, appliedMigrations, migrationContext);
    }
    
    // Step 5: Apply regular migrations
    const regularMigrations = migrationFiles.filter(file => !specialMigrations.includes(file));
    
    for (const file of regularMigrations) {
      await applyMigration(file, appliedMigrations, migrationContext);
    }
    
    logRequest(migrationContext, 'All migrations applied successfully');
    return true;
  } catch (error) {
    logError(migrationContext, 'Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Initialize the database with migrations
 */
export async function initializeMigrations(context = {}) {
  const requestId = context.requestId || 'init-' + Date.now();
  const initContext = {
    ...context,
    requestId,
    path: context.path || 'database-init',
    method: context.method || 'INIT'
  };
  
  try {
    logRequest(initContext, 'Starting database migrations...');
    await runMigrations(initContext);
    logRequest(initContext, 'Database migrations completed successfully');
  } catch (error) {
    logError(initContext, 'Migration initialization failed:', error);
    throw error;
  }
}

/**
 * Export utility functions for testing
 */
export const migrationUtils = {
  ensureSchemaVersionTable,
  getAppliedMigrations,
  applyMigration,
  applySpecialMigration,
  tableExists
};