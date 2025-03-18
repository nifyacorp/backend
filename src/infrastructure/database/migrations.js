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
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

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
      .sort();
    
    console.log('📁 Found migration files:', files);
    
    // Apply new migrations
    for (const file of files) {
      if (!appliedMigrations.has(file)) {
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
    }
    
    console.log('✨ Migrations system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize migrations:', error);
    throw error;
  }
}