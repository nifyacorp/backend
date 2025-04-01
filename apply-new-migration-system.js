/**
 * Script to apply the new migration system
 * 
 * This script provides a direct way to initialize the database with
 * the new consolidated schema.
 * 
 * Usage:
 *    node apply-new-migration-system.js [--force]
 * 
 * Options:
 *    --force   Force reset of schema even if tables exist
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'supabase/migrations');

// Create database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Parse command line arguments
const args = process.argv.slice(2);
const forceReset = args.includes('--force');

// Main function
async function applyMigration() {
  console.log('Applying new migration system...');
  
  const client = await pool.connect();
  
  try {
    // Step 1: Check if database is empty or --force is used
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const hasExistingTables = parseInt(tablesResult.rows[0].count, 10) > 0;
    
    if (hasExistingTables && !forceReset) {
      console.error('\n❌ Error: Database already has tables and --force not specified');
      console.error('Use --force to reset the database (WARNING: THIS WILL DELETE ALL DATA)\n');
      process.exit(1);
    }
    
    if (forceReset) {
      console.log('⚠️ FORCE mode is enabled - all existing data will be deleted!');
      console.log('You have 5 seconds to cancel (Ctrl+C)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Proceeding with force reset...');
    }
    
    // Step 2: Enable schema reset parameter
    if (forceReset) {
      await client.query("SET app.allow_schema_reset = 'true'");
      console.log('Schema reset parameter enabled');
    }
    
    // Step 3: Create the schema_version table directly
    console.log('Creating schema_version table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        description TEXT
      );
      
      CREATE OR REPLACE FUNCTION check_schema_version(required_version VARCHAR) 
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM schema_version 
          WHERE version = required_version
        );
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE OR REPLACE FUNCTION register_schema_version(version_id VARCHAR, version_description TEXT) 
      RETURNS VOID AS $$
      BEGIN
        INSERT INTO schema_version (version, description)
        VALUES (version_id, version_description)
        ON CONFLICT (version) DO NOTHING;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Step 4: Apply the consolidated schema
    console.log('Applying consolidated schema...');
    const schemaContent = await fs.readFile(
      path.join(MIGRATIONS_DIR, '20250402000000_consolidated_schema_reset.sql'),
      'utf-8'
    );
    
    await client.query(schemaContent);
    
    console.log('\n✅ Consolidated schema applied successfully!\n');
    
    // Step 5: Show the created tables
    const tablesAfter = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('Created tables:');
    tablesAfter.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    console.log('\nMigration system setup complete!');
  } catch (error) {
    console.error('Error applying migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});