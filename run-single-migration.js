// Run a single migration script for subscription_processing table
import { pool, query } from './src/infrastructure/database/client.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration file path
const MIGRATION_FILE = path.join(__dirname, 'supabase', 'migrations', '20250501000000_create_subscription_processing.sql');

async function runMigration() {
  console.log('Starting subscription_processing table migration');
  
  try {
    // Read the migration file
    console.log(`Reading migration file: ${MIGRATION_FILE}`);
    const sql = await fs.readFile(MIGRATION_FILE, 'utf8');
    
    // Connect to the database and run the migration
    console.log('Running migration script...');
    const result = await query(sql);
    
    console.log('Migration completed successfully');
    console.log('Verifying subscription_processing table...');
    
    // Verify the table was created
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'subscription_processing'
      ) as exists;
    `);
    
    if (tableCheckResult.rows[0].exists) {
      console.log('✅ subscription_processing table exists');
    } else {
      console.error('❌ subscription_processing table does not exist after migration!');
    }
    
    // Close the database connection
    pool.end();
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration(); 