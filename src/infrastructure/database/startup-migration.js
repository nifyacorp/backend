/**
 * NIFYA Database Schema Migration Utility
 * 
 * This module runs on service startup and ensures the database schema
 * matches the desired structure without requiring manual intervention.
 * 
 * It addresses two major issues found in the logs:
 * 1. Dependency on current_user_id() function which might not exist yet
 * 2. Dependency on columns like is_system that might not exist yet
 */

import { pool, query } from './client.js';
import { logRequest, logError } from '../../shared/logging/logger.js';
import { runMigrations as runCustomMigrations } from './migrations/index.js';

// Schema version to track migration
const CURRENT_SCHEMA_VERSION = '20250402000100';

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
    console.log(`Error checking if table ${tableName} exists:`, error.message);
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
    // First check if the table exists
    if (!(await tableExists(tableName))) {
      return false;
    }
    
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
    console.log(`Error checking if column ${columnName} exists in table ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Checks if an index exists
 * @param {string} indexName - Index name
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function indexExists(indexName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE indexname = $1
      )
    `, [indexName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.log(`Error checking if index ${indexName} exists:`, error.message);
    return false;
  }
}

/**
 * Checks if a function exists in the database
 * @param {string} functionName - Function name
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function functionExists(functionName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        WHERE proname = $1
      )
    `, [functionName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.log(`Error checking if function ${functionName} exists:`, error.message);
    return false;
  }
}

/**
 * Ensures the schema_version table exists
 */
async function ensureSchemaVersionTable() {
  try {
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
  } catch (error) {
    console.log('Error ensuring schema_version table:', error.message);
    // Continue execution even if this fails
  }
}

/**
 * Checks if a migration has been applied
 * @param {string} version - Migration version
 * @returns {Promise<boolean>} - True if applied, false otherwise
 */
async function isMigrationApplied(version) {
  try {
    // First check if the schema_version table exists
    if (!(await tableExists('schema_version'))) {
      return false;
    }
    
    const result = await query(
      'SELECT version FROM schema_version WHERE version = $1',
      [version]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.log(`Error checking if migration ${version} is applied:`, error.message);
    return false;
  }
}

/**
 * Records a migration as applied
 * @param {string} version - Migration version
 * @param {string} description - Migration description
 */
async function recordMigration(version, description) {
  try {
    // First ensure the schema_version table exists
    await ensureSchemaVersionTable();
    
    await query(
      'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [version, description]
    );
    console.log(`Recorded migration ${version}`);
  } catch (error) {
    console.log(`Error recording migration ${version}:`, error.message);
    // Continue execution even if this fails
  }
}

/**
 * Creates the current_user_id function if it doesn't exist
 * This function is referenced by RLS policies
 */
async function ensureCurrentUserIdFunction() {
  try {
    if (!(await functionExists('current_user_id'))) {
      await query(`
        CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
        DECLARE
          user_id UUID;
        BEGIN
          BEGIN
            -- Try to get the user_id from the app context
            user_id := current_setting('app.current_user_id', TRUE)::UUID;
            RETURN user_id;
          EXCEPTION WHEN OTHERS THEN
            -- Return NULL if setting doesn't exist or invalid cast
            RETURN NULL;
          END;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('Created current_user_id function');
    }
  } catch (error) {
    console.log('Error ensuring current_user_id function:', error.message);
  }
}

/**
 * Ensures the subscription_types table exists with required columns
 */
async function ensureSubscriptionTypesTable() {
  try {
    if (!(await tableExists('subscription_types'))) {
      await query(`
        CREATE TABLE subscription_types (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          icon VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb,
          is_system BOOLEAN DEFAULT TRUE
        )
      `);
      console.log('Created subscription_types table');
      
      // Insert default subscription types
      await query(`
        INSERT INTO subscription_types (id, name, display_name, icon)
        VALUES 
          ('boe', 'boe', 'BOE', 'FileText'),
          ('doga', 'doga', 'DOGA', 'FileText'),
          ('real-estate', 'real-estate', 'Real Estate', 'Home')
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('Inserted default subscription types');
    } else {
      // Ensure is_system column exists
      if (!(await columnExists('subscription_types', 'is_system'))) {
        await query(`
          ALTER TABLE subscription_types 
          ADD COLUMN is_system BOOLEAN DEFAULT TRUE
        `);
        console.log('Added is_system column to subscription_types table');
      }
    }
  } catch (error) {
    console.log('Error ensuring subscription_types table:', error.message);
  }
}

/**
 * Ensures the users table exists with required columns
 */
async function ensureUsersTable() {
  try {
    if (!(await tableExists('users'))) {
      // Create users table
      await query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          avatar_url TEXT,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb,
          notification_settings JSONB DEFAULT '{
            "emailNotifications": true,
            "notificationEmail": null,
            "emailFrequency": "daily",
            "instantNotifications": false,
            "language": "es"
          }'::jsonb,
          email_verified BOOLEAN DEFAULT false,
          name VARCHAR(255)
        )
      `);
      console.log('Created users table');
      
      // Add indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
      console.log('Created indexes on users table');
    } else {
      // Update users table if it exists
      
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
      if (!(await indexExists('idx_users_email_verified'))) {
        await query(`
          CREATE INDEX IF NOT EXISTS idx_users_email_verified 
          ON users(email_verified)
        `);
        console.log('Added email_verified index to users table');
      }
    }
  } catch (error) {
    console.log('Error ensuring users table:', error.message);
  }
}

/**
 * Ensures the subscriptions table exists with required columns
 */
async function ensureSubscriptionsTable() {
  try {
    // Only create if users and subscription_types tables exist
    if (!(await tableExists('users')) || !(await tableExists('subscription_types'))) {
      console.log('Users or subscription_types table missing, skipping subscriptions table creation');
      return;
    }
    
    if (!(await tableExists('subscriptions'))) {
      await query(`
        CREATE TABLE subscriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type_id VARCHAR(255) NOT NULL REFERENCES subscription_types(id),
          prompts JSONB DEFAULT '[]'::jsonb,
          frequency VARCHAR(50) NOT NULL,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);
      console.log('Created subscriptions table');
      
      // Add indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_type_id ON subscriptions(type_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);
      `);
      console.log('Created indexes on subscriptions table');
    }
  } catch (error) {
    console.log('Error ensuring subscriptions table:', error.message);
  }
}

/**
 * Ensures the notifications table exists with required columns
 */
async function ensureNotificationsTable() {
  try {
    // Only create if users table exists
    if (!(await tableExists('users'))) {
      console.log('Users table missing, skipping notifications table creation');
      return;
    }
    
    if (!(await tableExists('notifications'))) {
      await query(`
        CREATE TABLE notifications (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          read BOOLEAN DEFAULT FALSE,
          entity_type VARCHAR(255) DEFAULT 'notification:generic',
          source VARCHAR(50),
          data JSONB DEFAULT '{}'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          email_sent BOOLEAN DEFAULT FALSE,
          email_sent_at TIMESTAMP WITH TIME ZONE,
          read_at TIMESTAMP WITH TIME ZONE,
          source_url TEXT,
          subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL
        )
      `);
      console.log('Created notifications table');
      
      // Add indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
        CREATE INDEX IF NOT EXISTS idx_notifications_entity_type ON notifications(entity_type);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id ON notifications(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(email_sent);
      `);
      console.log('Created indexes on notifications table');
    } else {
      // Update notifications table if it exists
      
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
      
      // Add entity_type column if missing
      if (!(await columnExists('notifications', 'entity_type'))) {
        await query(`
          ALTER TABLE notifications 
          ADD COLUMN entity_type VARCHAR(255) DEFAULT 'notification:generic'
        `);
        console.log('Added entity_type column to notifications table');
      }
      
      // Add indexes if missing
      if (!(await indexExists('idx_notifications_subscription_id'))) {
        await query(`
          CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id 
          ON notifications(subscription_id)
        `);
        console.log('Added subscription_id index to notifications table');
      }
      
      if (!(await indexExists('idx_notifications_email_sent'))) {
        await query(`
          CREATE INDEX IF NOT EXISTS idx_notifications_email_sent 
          ON notifications(email_sent)
        `);
        console.log('Added email_sent index to notifications table');
      }
      
      if (!(await indexExists('idx_notifications_entity_type'))) {
        await query(`
          CREATE INDEX IF NOT EXISTS idx_notifications_entity_type 
          ON notifications(entity_type)
        `);
        console.log('Added entity_type index to notifications table');
      }
    }
  } catch (error) {
    console.log('Error ensuring notifications table:', error.message);
  }
}

/**
 * Ensures the user_email_preferences table exists
 */
async function ensureEmailPreferencesTable() {
  try {
    // Only create if users and subscription_types tables exist
    if (!(await tableExists('users')) || !(await tableExists('subscription_types'))) {
      console.log('Users or subscription_types table missing, skipping user_email_preferences table creation');
      return;
    }
    
    if (!(await tableExists('user_email_preferences'))) {
      await query(`
        CREATE TABLE user_email_preferences (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          subscription_type VARCHAR(255) REFERENCES subscription_types(id),
          frequency VARCHAR(50) DEFAULT 'immediate',
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, subscription_type)
        )
      `);
      console.log('Created user_email_preferences table');
      
      // Add index
      await query(`
        CREATE INDEX IF NOT EXISTS idx_user_email_preferences_user_id 
        ON user_email_preferences(user_id)
      `);
      console.log('Created index on user_email_preferences table');
    }
  } catch (error) {
    console.log('Error ensuring user_email_preferences table:', error.message);
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
 * Creates or updates RLS policies
 */
async function setupRLSPolicies() {
  try {
    // Only proceed if the current_user_id function exists
    if (!(await functionExists('current_user_id'))) {
      console.log('current_user_id function not found, skipping RLS policy setup');
      return;
    }
    
    // Enable RLS on tables
    const tables = ['users', 'subscriptions', 'notifications', 'user_email_preferences'];
    for (const table of tables) {
      if (await tableExists(table)) {
        await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`Enabled RLS on ${table} table`);
      }
    }
    
    // Create RLS policy for users table
    if (await tableExists('users')) {
      // Drop any existing policies
      try {
        await query(`DROP POLICY IF EXISTS users_self_access ON users`);
      } catch (error) {
        // Ignore error if policy doesn't exist
      }
      
      // Create new policy
      await query(`
        CREATE POLICY users_self_access ON users
        FOR ALL
        USING (id::text = current_setting('app.current_user_id', TRUE))
      `);
      console.log('Created RLS policy for users table');
    }
    
    // Create RLS policy for subscriptions table
    if (await tableExists('subscriptions')) {
      // Drop any existing policies
      try {
        await query(`DROP POLICY IF EXISTS subscriptions_user_access ON subscriptions`);
      } catch (error) {
        // Ignore error if policy doesn't exist
      }
      
      // Create new policy
      await query(`
        CREATE POLICY subscriptions_user_access ON subscriptions
        FOR ALL
        USING (user_id::text = current_setting('app.current_user_id', TRUE))
      `);
      console.log('Created RLS policy for subscriptions table');
    }
    
    // Create RLS policy for notifications table
    if (await tableExists('notifications')) {
      // Drop any existing policies
      try {
        await query(`DROP POLICY IF EXISTS notifications_user_access ON notifications`);
      } catch (error) {
        // Ignore error if policy doesn't exist
      }
      
      // Create new policy
      await query(`
        CREATE POLICY notifications_user_access ON notifications
        FOR ALL
        USING (user_id::text = current_setting('app.current_user_id', TRUE))
      `);
      console.log('Created RLS policy for notifications table');
    }
    
    // Create RLS policy for user_email_preferences table
    if (await tableExists('user_email_preferences')) {
      // Drop any existing policies
      try {
        await query(`DROP POLICY IF EXISTS user_email_preferences_user_access ON user_email_preferences`);
      } catch (error) {
        // Ignore error if policy doesn't exist
      }
      
      // Create new policy
      await query(`
        CREATE POLICY user_email_preferences_user_access ON user_email_preferences
        FOR ALL
        USING (user_id::text = current_setting('app.current_user_id', TRUE))
      `);
      console.log('Created RLS policy for user_email_preferences table');
    }
  } catch (error) {
    console.log('Error setting up RLS policies:', error.message);
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
      
      // Create/update current_user_id function (required by RLS)
      await ensureCurrentUserIdFunction();
      
      // Create/update tables in dependency order
      await ensureSubscriptionTypesTable();
      await ensureUsersTable();
      await ensureSubscriptionsTable();
      await ensureNotificationsTable();
      await ensureEmailPreferencesTable();
      
      // Set up RLS policies after tables are created
      await setupRLSPolicies();
      
      // Record the migration
      await recordMigration(
        CURRENT_SCHEMA_VERSION, 
        'Comprehensive startup migration with RLS fixes'
      );
      
      // Commit the transaction
      await client.query('COMMIT');
      
      // Run custom migrations (including Firebase UID)
      // These run outside the main transaction as they have their own transaction handling
      logRequest(migrationContext, 'Running custom migrations');
      await runCustomMigrations();
      
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