// Database migration runner script
const { promises: fs } = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nifya',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

/**
 * Run a SQL migration file against the database
 */
async function runMigration(filePath, fileName) {
  console.log(`Running migration: ${fileName}`);
  
  try {
    // Read migration file
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Run migration in a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Run the migration
      await client.query(sql);
      
      // Record the migration in the migrations table
      await client.query(
        `INSERT INTO migrations (name, applied_at)
         VALUES ($1, NOW())
         ON CONFLICT (name) DO NOTHING`,
        [fileName]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migration ${fileName} applied successfully`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Error applying migration ${fileName}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`❌ Failed to run migration ${fileName}:`, err.message);
    throw err;
  }
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable() {
  try {
    // Check if migrations table exists, create if not
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL
      )
    `);
    console.log('✅ Migrations table verified/created');
  } catch (err) {
    console.error('❌ Failed to create migrations table:', err.message);
    throw err;
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  try {
    const result = await pool.query('SELECT name FROM migrations ORDER BY applied_at');
    return result.rows.map(r => r.name);
  } catch (err) {
    console.error('❌ Failed to get applied migrations:', err.message);
    throw err;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get list of applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log(`Found ${appliedMigrations.length} already applied migrations`);
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = await fs.readdir(migrationsDir);
    
    // Filter SQL files and sort by name
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(f => !appliedMigrations.includes(f));
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to apply');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations to apply:`);
    pendingMigrations.forEach(m => console.log(`- ${m}`));
    
    // Run each pending migration
    for (const migration of pendingMigrations) {
      await runMigration(path.join(migrationsDir, migration), migration);
    }
    
    console.log('🎉 All migrations applied successfully');
  } catch (err) {
    console.error('Migration process failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();