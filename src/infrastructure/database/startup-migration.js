/**
 * NIFYA Database Schema Migration Utility
 * 
 * This module runs on service startup and ensures the database schema
 * matches the desired structure without requiring manual intervention.
 */

import { pool, query } from './client.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

// Schema version to track migration
const CURRENT_SCHEMA_VERSION = '20250401000001';

/**
 * Checks if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function tableExists(tableName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    // If error occurs, assume table doesn't exist
    return false;
  }
}

/**
 * Checks if a column exists in a table
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function columnExists(tableName, columnName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )
    `, [tableName, columnName]);
    
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

/**
 * Ensures the schema_version table exists
 */
async function ensureSchemaVersionTable() {
  const exists = await tableExists('schema_version');
  
  if (!exists) {
    await query(`
      CREATE TABLE schema_version (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        description TEXT
      )
    `);
    
    console.log('Created schema_version table');
  }
}

/**
 * Checks if a migration has been applied
 * @param {string} version - Migration version
 * @returns {Promise<boolean>} - True if applied, false otherwise
 */
async function isMigrationApplied(version) {
  try {
    const result = await query(
      'SELECT version FROM schema_version WHERE version = $1',
      [version]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Records a migration as applied
 * @param {string} version - Migration version
 * @param {string} description - Migration description
 */
async function recordMigration(version, description) {
  await query(
    'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
    [version, description]
  );
}

/**
 * Adds missing columns to notifications table
 */
async function updateNotificationsTable() {
  // Check if notifications table exists
  if (!(await tableExists('notifications'))) {
    console.log('Notifications table does not exist, skipping update');
    return;
  }
  
  // Add subscription_id column if missing
  if (!(await columnExists('notifications', 'subscription_id'))) {
    await query(`
      ALTER TABLE notifications 
      ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL
    `);
    console.log('Added subscription_id column to notifications table');
  }
  
  // Add source_url column if missing
  if (!(await columnExists('notifications', 'source_url'))) {
    await query(`
      ALTER TABLE notifications 
      ADD COLUMN source_url TEXT
    `);
    console.log('Added source_url column to notifications table');
  }
  
  // Add read_at column if missing
  if (!(await columnExists('notifications', 'read_at'))) {
    await query(`
      ALTER TABLE notifications 
      ADD COLUMN read_at TIMESTAMP WITH TIME ZONE
    `);
    console.log('Added read_at column to notifications table');
  }
  
  // Add email_sent_at column if missing
  if (!(await columnExists('notifications', 'email_sent_at'))) {
    await query(`
      ALTER TABLE notifications 
      ADD COLUMN email_sent_at TIMESTAMP WITH TIME ZONE
    `);
    console.log('Added email_sent_at column to notifications table');
  }
  
  // Add index for subscription_id if missing
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id 
      ON notifications(subscription_id)
    `);
  } catch (error) {
    // If error (like index already exists), just log and continue
    console.log('Error creating subscription_id index:', error.message);
  }
  
  // Add index for email_sent if missing
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_email_sent 
      ON notifications(email_sent)
    `);
  } catch (error) {
    console.log('Error creating email_sent index:', error.message);
  }
}

/**
 * Updates users table to include notification_settings
 */
async function updateUsersTable() {
  // Check if users table exists
  if (!(await tableExists('users'))) {
    console.log('Users table does not exist, skipping update');
    return;
  }
  
  // Add name column if missing
  if (!(await columnExists('users', 'name'))) {
    await query(`
      ALTER TABLE users 
      ADD COLUMN name VARCHAR(255)
    `);
    console.log('Added name column to users table');
  }
  
  // Add email_verified column if missing
  if (!(await columnExists('users', 'email_verified'))) {
    await query(`
      ALTER TABLE users 
      ADD COLUMN email_verified BOOLEAN DEFAULT false
    `);
    console.log('Added email_verified column to users table');
  }
  
  // Add notification_settings column if missing
  if (!(await columnExists('users', 'notification_settings'))) {
    await query(`
      ALTER TABLE users 
      ADD COLUMN notification_settings JSONB DEFAULT '{
        "emailNotifications": true,
        "notificationEmail": null,
        "emailFrequency": "daily",
        "instantNotifications": false,
        "language": "es"
      }'::jsonb
    `);
    console.log('Added notification_settings column to users table');
  }
  
  // Add index for email_verified if missing
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_verified 
      ON users(email_verified)
    `);
  } catch (error) {
    console.log('Error creating email_verified index:', error.message);
  }
}

/**
 * Ensures required database extensions are installed
 */
async function ensureExtensions() {
  try {
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('Ensured uuid-ossp extension is installed');
  } catch (error) {
    console.log('Error ensuring extensions:', error.message);
  }
}

/**
 * Main migration function
 * @param {Object} context - Logging context
 */
export async function migrateDatabase(context) {
  const migrationContext = {
    requestId: context?.requestId || `migration-${Date.now()}`,
    path: 'startup-migration',
    method: 'MIGRATE'
  };
  
  try {
    logRequest(migrationContext, 'Starting database schema migration');
    
    // First, check if this migration has already been applied
    // This prevents running migrations multiple times
    await ensureSchemaVersionTable();
    
    if (await isMigrationApplied(CURRENT_SCHEMA_VERSION)) {
      logRequest(migrationContext, `Schema version ${CURRENT_SCHEMA_VERSION} already applied, skipping migration`);
      return true;
    }
    
    // Get a client for transaction
    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      // Make sure extensions are installed
      await ensureExtensions();
      
      // Apply schema changes
      await updateNotificationsTable();
      await updateUsersTable();
      
      // Record the migration
      await recordMigration(
        CURRENT_SCHEMA_VERSION, 
        'Startup migration for schema compatibility'
      );
      
      // Commit the transaction
      await client.query('COMMIT');
      
      logRequest(migrationContext, 'Database schema migration completed successfully');
      return true;
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Always release the client
      client.release();
    }
    
  } catch (error) {
    logError(migrationContext, 'Database migration failed', error);
    
    // Log detailed error information
    console.error('Migration error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Function to call early in the application startup
 */
export async function runStartupMigration() {
  console.log('Checking database schema and applying migrations if needed...');
  
  try {
    const success = await migrateDatabase();
    
    if (success) {
      console.log('✅ Database schema is up to date');
    } else {
      console.error('⚠️ Database schema migration failed, see logs for details');
    }
    
    return success;
  } catch (error) {
    console.error('❌ Fatal error during database migration:', error);
    return false;
  }
}