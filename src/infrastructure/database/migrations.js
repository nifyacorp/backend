import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration table to track applied migrations
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    script_hash VARCHAR(64)
  );
`;

// Consolidated migration file - this is the current schema state
// Skip the consolidated schema due to syntax issues
// const CONSOLIDATED_MIGRATION = '20250301000000_consolidated_schema.sql';
const CONSOLIDATED_MIGRATION = '20250323000000_fix_consolidated_schema.sql';
const PROBLEMATIC_FILES = ['20250301000000_consolidated_schema.sql'];

export async function initializeMigrations() {
  // Check if we're in development mode with DB validation skipped
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_DB_VALIDATION === 'true') {
    console.log('🔄 Development mode with SKIP_DB_VALIDATION - skipping migrations');
    
    // Just read the migration files for logging purposes
    try {
      const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      console.log('📁 Found migration files:', files);
      console.log('💡 Using consolidated schema: ' + CONSOLIDATED_MIGRATION);
      console.log('✨ Migrations system initialized successfully');
      return;
    } catch (error) {
      console.warn('⚠️ Could not read migration files:', error.message);
      return;
    }
  }

  try {
    console.log('🔄 Initializing migrations system...');
    
    // Create migrations table if it doesn't exist
    await query(MIGRATIONS_TABLE);
    
    // Get list of applied migrations
    const { rows: applied } = await query(
      'SELECT name FROM schema_migrations ORDER BY applied_at ASC'
    );
    const appliedMigrations = new Set(applied.map(row => row.name));
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .filter(file => !PROBLEMATIC_FILES.includes(file)) // Skip problematic files
      .sort();
    
    console.log('📁 Found migration files:', files);
    
    // Check if we've already applied the consolidated migration
    if (appliedMigrations.has(CONSOLIDATED_MIGRATION)) {
      console.log(`✅ Consolidated schema already applied: ${CONSOLIDATED_MIGRATION}`);
      
      // Apply any migrations that came after the consolidated one
      const consolidatedIndex = files.indexOf(CONSOLIDATED_MIGRATION);
      if (consolidatedIndex >= 0 && consolidatedIndex < files.length - 1) {
        const newerMigrations = files.slice(consolidatedIndex + 1);
        console.log(`📊 Found ${newerMigrations.length} newer migrations to apply`);
        
        for (const file of newerMigrations) {
          if (!appliedMigrations.has(file)) {
            await applyMigration(migrationsDir, file);
          }
        }
      }
    } else {
      // Apply consolidated migration first
      if (files.includes(CONSOLIDATED_MIGRATION)) {
        console.log(`⚡ Applying consolidated schema: ${CONSOLIDATED_MIGRATION}`);
        await applyMigration(migrationsDir, CONSOLIDATED_MIGRATION);
        
        // Mark all older migrations as applied too
        const consolidatedIndex = files.indexOf(CONSOLIDATED_MIGRATION);
        if (consolidatedIndex > 0) {
          const olderMigrations = files.slice(0, consolidatedIndex);
          console.log(`📝 Marking ${olderMigrations.length} older migrations as applied`);
          
          for (const file of olderMigrations) {
            if (!appliedMigrations.has(file)) {
              await query(
                'INSERT INTO schema_migrations (name, script_hash) VALUES ($1, $2)',
                [file, 'consolidated']
              );
            }
          }
        }
        
        // Apply any newer migrations
        const newerMigrations = files.slice(consolidatedIndex + 1);
        for (const file of newerMigrations) {
          if (!appliedMigrations.has(file)) {
            await applyMigration(migrationsDir, file);
          }
        }
      } else {
        console.warn(`⚠️ Consolidated schema file not found: ${CONSOLIDATED_MIGRATION}`);
        
        // Fall back to traditional migration approach
        for (const file of files) {
          if (!appliedMigrations.has(file)) {
            await applyMigration(migrationsDir, file);
          }
        }
      }
    }
    
    console.log('✨ Migrations system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize migrations:', error);
    throw error;
  }
}

/**
 * Applies a single migration file
 * @param {string} migrationsDir - Directory containing migration files
 * @param {string} file - Filename of the migration to apply
 */
async function applyMigration(migrationsDir, file) {
  console.log(`⚡ Applying migration: ${file}`);
  
  const migrationPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    await query('BEGIN');
    await query(sql);
    await query(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      [file]
    );
    await query('COMMIT');
    
    console.log(`✅ Migration applied successfully: ${file}`);
  } catch (error) {
    await query('ROLLBACK');
    console.error(`❌ Migration failed: ${file}`, error);
    throw error;
  }
}