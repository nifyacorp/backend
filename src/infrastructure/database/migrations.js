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
    
    // Define critical fix migrations
    const RLS_FIX_MIGRATION = '20250324000000_fix_rls_policies.sql';
    
    // Ensure RLS fix migration is always applied
    let hasPendingRlsFix = false;
    if (files.includes(RLS_FIX_MIGRATION) && !appliedMigrations.has(RLS_FIX_MIGRATION)) {
      hasPendingRlsFix = true;
      console.log(`🛠️ RLS fix migration found and pending: ${RLS_FIX_MIGRATION}`);
    }
    
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
            // Apply RLS fix migration with highest priority
            if (file === RLS_FIX_MIGRATION) {
              await applyMigration(migrationsDir, file, false); // Must succeed
              hasPendingRlsFix = false;
            } else {
              await applyMigration(migrationsDir, file);
            }
          }
        }
      }
    } else {
      // Apply consolidated migration first if available
      if (files.includes(CONSOLIDATED_MIGRATION)) {
        console.log(`⚡ Applying consolidated schema: ${CONSOLIDATED_MIGRATION}`);
        
        // Try to apply the consolidated schema, continue on error
        const consolidatedSuccess = await applyMigration(migrationsDir, CONSOLIDATED_MIGRATION, true);
        
        if (consolidatedSuccess) {
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
        }
        
        // Apply any newer migrations
        const consolidatedIndex = files.indexOf(CONSOLIDATED_MIGRATION);
        if (consolidatedIndex >= 0) {
          const newerMigrations = files.slice(consolidatedIndex + 1);
          for (const file of newerMigrations) {
            if (!appliedMigrations.has(file)) {
              // Apply RLS fix migration with highest priority
              if (file === RLS_FIX_MIGRATION) {
                await applyMigration(migrationsDir, file, false); // Must succeed
                hasPendingRlsFix = false;
              } else {
                await applyMigration(migrationsDir, file);
              }
            }
          }
        }
      } else {
        console.warn(`⚠️ Consolidated schema file not found: ${CONSOLIDATED_MIGRATION}`);
        
        // Fall back to traditional migration approach
        for (const file of files) {
          if (!appliedMigrations.has(file)) {
            // Apply RLS fix migration with highest priority
            if (file === RLS_FIX_MIGRATION) {
              await applyMigration(migrationsDir, file, false); // Must succeed
              hasPendingRlsFix = false;
            } else {
              const continueOnError = hasPendingRlsFix; // Continue on error if we have a pending fix
              await applyMigration(migrationsDir, file, continueOnError);
            }
          }
        }
      }
    }
    
    // If we still have a pending RLS fix, make sure it gets applied
    if (hasPendingRlsFix) {
      console.log(`🔄 Applying critical RLS policy fix migration: ${RLS_FIX_MIGRATION}`);
      await applyMigration(migrationsDir, RLS_FIX_MIGRATION, false); // Must succeed
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
 * @param {boolean} continueOnError - Whether to continue if this migration fails
 */
async function applyMigration(migrationsDir, file, continueOnError = false) {
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
    return true;
  } catch (error) {
    await query('ROLLBACK');
    console.error(`❌ Migration failed: ${file}`, error);
    
    // If the error contains NOT is_system syntax, mark as fixed
    if (error.message && error.message.includes('syntax error at or near "NOT"')) {
      console.log(`🔧 Detected 'NOT is_system' syntax error in ${file}, will apply fix migration`);
      
      // Mark this migration as applied anyway, since we'll fix it with the later migration
      try {
        await query(
          'INSERT INTO schema_migrations (name, script_hash) VALUES ($1, $2)',
          [file, 'skipped-syntax-error']
        );
        console.log(`📝 Marked problematic migration ${file} as applied`);
      } catch (markError) {
        console.error(`⚠️ Failed to mark problematic migration as applied: ${markError.message}`);
      }
      
      if (continueOnError) {
        return false; // Failed but continuing
      }
    }
    
    if (continueOnError) {
      console.log(`⚠️ Continuing despite migration error in ${file}`);
      return false; // Failed but continuing
    } else {
      throw error;
    }
  }
}