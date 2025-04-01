/**
 * Improved database migration system for NIFYA backend
 * 
 * This system provides:
 * 1. Transaction support for migrations
 * 2. Version checking to prevent re-applying migrations
 * 3. Better error handling and reporting
 * 4. Support for both incremental and consolidated migrations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, withTransaction } from './client.js';
import { AppError } from '../../shared/errors/AppError.js';

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
 * Create the schema_version table if it doesn't exist
 */
async function ensureSchemaVersionTable() {
  try {
    // Check if schema_version table exists first
    const checkResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_version'
      );
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Creating schema_version table...');
      
      // Create schema_version table and helper functions
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
      
      console.log('Schema version table created');
    } else {
      console.log('Schema version table already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to create schema_version table:', error);
    throw new AppError(
      'DATABASE_INIT_ERROR',
      'Failed to initialize schema version tracking',
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
    const checkResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_version'
      );
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Schema version table does not exist, returning empty applied migrations set');
      return new Set(); // No migrations applied yet
    }
    
    // If the table exists, get the applied migrations
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
 * Apply a single migration
 */
async function applyMigration(migrationFile, appliedMigrations) {
  // Extract version number from filename (format: 12345678_name.sql)
  const version = path.basename(migrationFile).split('_')[0];
  console.log(`⚡ Applying migration: ${migrationFile}`);
  
  // Skip if already applied
  if (appliedMigrations.has(version)) {
    console.log(`✅ Migration ${version} already applied, skipping`);
    return true;
  }
  
  // Read migration file
  let sqlContent;
  try {
    sqlContent = await fs.readFile(path.join(MIGRATIONS_DIR, migrationFile), 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to read migration file ${migrationFile}:`, error);
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Failed to read migration file: ${error.message}`,
      500,
      { file: migrationFile }
    );
  }
  
  // Apply migration within a transaction
  try {
    await withTransaction(null, async (client) => {
      // Execute the migration
      await client.query(sqlContent);
      
      // Record the migration
      await client.query(
        'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
        [version, `Migration from file ${migrationFile}`]
      );
      
      console.log(`✅ Migration ${version} applied successfully`);
    });
    
    return true;
  } catch (error) {
    // Enhance error with location information
    const errorLocation = getErrorLocation(error, sqlContent);
    
    console.error(`❌ Migration failed: ${migrationFile}`, error);
    
    if (errorLocation) {
      console.error(`   Error at line ${errorLocation.lineNumber}: ${errorLocation.lineContent}`);
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
  }
}

/**
 * Apply a consolidated schema migration
 * This requires special handling as it potentially resets the entire database
 */
async function applyConsolidatedMigration(migrationFile, appliedMigrations) {
  const version = path.basename(migrationFile).split('_')[0];
  console.log(`⚡ Applying consolidated schema migration: ${migrationFile}`);
  
  // Skip if already applied
  if (appliedMigrations.has(version)) {
    console.log(`✅ Consolidated migration ${version} already applied, skipping`);
    return true;
  }
  
  // Read migration file
  let sqlContent;
  try {
    sqlContent = await fs.readFile(path.join(MIGRATIONS_DIR, migrationFile), 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to read consolidated migration file ${migrationFile}:`, error);
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Failed to read consolidated migration file: ${error.message}`,
      500,
      { file: migrationFile }
    );
  }
  
  // For consolidated migrations, execute directly without transaction
  // since they often include DROP SCHEMA which can't be in a transaction
  try {
    // First set the GUC parameter to allow schema reset
    await query("SET LOCAL app.allow_schema_reset = 'true'");
    
    // Execute the migration
    await query(sqlContent);
    
    console.log(`✅ Consolidated migration ${version} applied successfully`);
    return true;
  } catch (error) {
    // Enhance error with location information
    const errorLocation = getErrorLocation(error, sqlContent);
    
    console.error(`❌ Consolidated migration failed: ${migrationFile}`, error);
    
    if (errorLocation) {
      console.error(`   Error at line ${errorLocation.lineNumber}: ${errorLocation.lineContent}`);
    }
    
    throw new AppError(
      MIGRATION_ERRORS.EXECUTION_ERROR.code,
      `Consolidated migration failed: ${error.message}`,
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
 * Run all database migrations
 */
export async function runMigrations() {
  // Setup schema version tracking if needed
  await ensureSchemaVersionTable();
  
  // Get list of migrations already applied
  const appliedMigrations = await getAppliedMigrations();
  
  try {
    // Get all migration files
    const files = await fs.readdir(MIGRATIONS_DIR);
    
    // Filter for SQL files and sort by version/name
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found migration files: ${JSON.stringify(migrationFiles, null, 2)}`);
    
    // Apply each migration
    for (const migrationFile of migrationFiles) {
      // Skip the fixed files
      if (migrationFile.endsWith('.fixed.sql')) {
        continue;
      }
      
      // Special handling for consolidated schema migrations
      if (migrationFile.includes('consolidated_schema_reset')) {
        try {
          await applyConsolidatedMigration(migrationFile, appliedMigrations);
        } catch (error) {
          console.error(`❌ Consolidated migration failed: ${migrationFile}`, error);
          throw error;
        }
      } else {
        try {
          await applyMigration(migrationFile, appliedMigrations);
        } catch (error) {
          console.error(`❌ Migration failed: ${migrationFile}`, error);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations applied successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Initialize the database with all migrations
 */
export async function initializeMigrations() {
  try {
    console.log('Starting database migrations...');
    await runMigrations();
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Export direct access to migration functions for testing
 */
export const migrationUtils = {
  ensureSchemaVersionTable,
  getAppliedMigrations,
  applyMigration,
  applyConsolidatedMigration
};