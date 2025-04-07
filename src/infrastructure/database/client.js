import pg from 'pg';
import dotenv from 'dotenv';
import { AppError } from '../../shared/errors/AppError.js';
import { validateRequiredEnvVars } from '../../shared/utils/env.js';
// Migration system configuration
// Prioritize startup migration, then fall back to single schema, then traditional migrations
const USE_STARTUP_MIGRATION = process.env.USE_STARTUP_MIGRATION !== 'false'; // Default to true
const USE_SINGLE_SCHEMA = process.env.USE_SINGLE_SCHEMA !== 'false'; // Default to true

// Import the migration systems
import { initializeMigrations as initializeMultipleMigrations } from './safe-migrations.js';
import { initializeMigrations as initializeSingleSchema } from './single-schema-migrations.js';

// The traditional migrations will only be used as fallback
const initializeMigrations = USE_SINGLE_SCHEMA ? initializeSingleSchema : initializeMultipleMigrations;

dotenv.config();

// Determine if running in production or development
const isProduction = process.env.NODE_ENV === 'production';
const isLocalDevelopment = !isProduction;

// Skip validation in development mode if specified
if (!(isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true')) {
  // Validate required environment variables
  validateRequiredEnvVars([
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ]);
}

const { Pool } = pg;

// Configure database connection
let dbConfig;

if (isProduction) {
  // Production: Connect to Cloud SQL instance
  dbConfig = {
    host: '/cloudsql/delta-entity-447812-p2:us-central1:nifya-db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  };
} else {
  // Local development: Connect to local PostgreSQL
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  };
}

// Log database configuration (excluding sensitive data)
console.log('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  hasUser: !!dbConfig.user,
  hasPassword: !!dbConfig.password,
  environment: isProduction ? 'production' : 'development',
  timestamp: new Date().toISOString()
});

// Create database connection pool
export const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected database error:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });
});

export async function query(text, params) {
  // Skip actual DB operations in development mode if specified
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    console.log('DEVELOPMENT MODE: Skipping database query:', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });
    
    // Mock subscription type data for getUserSubscriptions
    if (text.includes('SELECT COUNT(*) as total FROM subscriptions')) {
      return { 
        rows: [{ total: 1 }], 
        rowCount: 1 
      };
    }
    
    // Mock getUserSubscriptions data
    if (text.includes('SELECT s.id, s.type_id, s.name, s.description, s.prompts')) {
      return { 
        rows: [{
          id: 'mock-subscription-id',
          name: 'Mock Subscription',
          description: 'This is a mock subscription for development',
          prompts: ['keyword1', 'keyword2'],
          type: 'boe',
          typeName: 'BOE',
          typeIcon: 'FileText',
          frequency: 'daily',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        rowCount: 1
      };
    }
    
    // Mock subscription stats
    if (text.includes('SELECT COUNT(*) as count FROM subscriptions')) {
      return { 
        rows: [{ count: 1 }], 
        rowCount: 1 
      };
    }
    
    if (text.includes('SELECT frequency, COUNT(*) as count FROM subscriptions')) {
      return { 
        rows: [{ frequency: 'daily', count: 1 }], 
        rowCount: 1 
      };
    }
    
    if (text.includes('SELECT t.name as source, COUNT(*) as count FROM subscriptions')) {
      return { 
        rows: [{ source: 'BOE', count: 1 }], 
        rowCount: 1 
      };
    }
    
    // MOCK SUBSCRIPTION TYPES data for type.service.js
    if (text.includes('FROM subscription_types')) {
      // For getSubscriptionTypes query
      if (text.includes('ORDER BY is_system DESC') || text.includes('ORDER BY name ASC')) {
        return {
          rows: [
            {
              id: 'boe',
              name: 'BOE',
              description: 'Boletín Oficial del Estado',
              icon: 'FileText',
              isSystem: true,
              createdBy: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'doga',
              name: 'DOGA',
              description: 'Diario Oficial de Galicia',
              icon: 'FileText',
              isSystem: true,
              createdBy: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'real-estate',
              name: 'Inmobiliaria',
              description: 'Búsquedas inmobiliarias',
              icon: 'Home',
              isSystem: true,
              createdBy: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          rowCount: 3
        };
      }
      
      // For createSubscriptionType query
      if (text.includes('INSERT INTO subscription_types')) {
        return {
          rows: [{
            id: 'custom-type-' + Date.now(),
            name: params[0] || 'Custom Type',
            description: params[1] || 'Custom subscription type',
            icon: params[2] || 'Star',
            isSystem: false,
            createdBy: params[3] || 'mock-user-id',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }],
          rowCount: 1
        };
      }
    }
    
    // MOCK TEMPLATE data for template.service.js
    if (text.includes('FROM subscription_templates')) {
      // For getPublicTemplates query
      if (text.includes('WHERE t.is_public = true')) {
        return {
          rows: [
            {
              id: 'boe-general',
              type: 'boe',
              name: 'BOE General',
              description: 'Seguimiento general del Boletín Oficial del Estado',
              prompts: ['disposición', 'ley', 'real decreto'],
              frequency: 'daily',
              icon: 'GanttChart',
              logo: 'https://www.boe.es/favicon.ico',
              metadata: { category: 'government', source: 'boe' },
              isPublic: true,
              createdBy: null,
              createdAt: new Date().toISOString()
            },
            {
              id: 'boe-subvenciones',
              type: 'boe',
              name: 'Subvenciones BOE',
              description: 'Alertas de subvenciones y ayudas públicas',
              prompts: ['subvención', 'ayuda', 'convocatoria'],
              frequency: 'immediate',
              icon: 'Coins',
              logo: 'https://www.boe.es/favicon.ico',
              metadata: { category: 'government', source: 'boe' },
              isPublic: true,
              createdBy: null,
              createdAt: new Date().toISOString()
            }
          ],
          rowCount: 2
        };
      }
      
      // For getTemplateById query
      if (text.includes('WHERE t.id = $1')) {
        return {
          rows: [{
            id: params[0] || 'template-id',
            type: 'boe',
            name: 'BOE Template',
            description: 'Template for BOE subscriptions',
            prompts: ['keyword1', 'keyword2'],
            frequency: 'daily',
            icon: 'FileText',
            logo: 'https://www.boe.es/favicon.ico',
            metadata: { category: 'government', source: 'boe' },
            isPublic: true,
            createdBy: null,
            createdAt: new Date().toISOString()
          }],
          rowCount: 1
        };
      }
      
      // For countPublicTemplates query
      if (text.includes('COUNT(*)') && text.includes('WHERE t.is_public = true')) {
        return {
          rows: [{ count: '2' }],
          rowCount: 1
        };
      }
      
      // For createTemplate query
      if (text.includes('INSERT INTO subscription_templates')) {
        return {
          rows: [{
            id: 'custom-template-' + Date.now(),
            type: params[0] || 'boe',
            name: params[1] || 'Custom Template',
            description: params[2] || 'Custom template description',
            prompts: params[3] || ['keyword1', 'keyword2'],
            frequency: params[4] || 'daily',
            icon: params[5] || 'Star',
            logo: params[6] || null,
            metadata: params[7] ? JSON.parse(params[7]) : {},
            isPublic: params[8] || false,
            createdBy: params[9] || 'mock-user-id',
            createdAt: new Date().toISOString()
          }],
          rowCount: 1
        };
      }
    }
    
    // MOCK getSubscriptionTypeId query for template repository
    if (text.includes('SELECT id FROM subscription_types WHERE name = $1')) {
      return {
        rows: [{
          id: 'boe'
        }],
        rowCount: 1
      };
    }
    
    return { rows: [], rowCount: 0 };
  }

  const start = Date.now();
  let client;
  
  try {
    // Get client from pool
    client = await pool.connect();
    
    console.log('Database connection obtained for query:', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      paramCount: params ? params.length : 0,
      timestamp: new Date().toISOString()
    });
    
    // Execute query
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    console.log('Query executed successfully:', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rowCount: res.rowCount,
      timestamp: new Date().toISOString()
    });
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      params: params ? `${params.length} parameters` : 'no parameters',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    throw new AppError(
      'DATABASE_ERROR',
      `Database operation failed: ${error.message}`,
      500,
      { 
        originalError: error.message,
        code: error.code,
        detail: error.detail
      }
    );
  } finally {
    // Release client back to pool
    if (client) {
      try {
        client.release();
        console.log('Database connection released', {
          timestamp: new Date().toISOString()
        });
      } catch (releaseError) {
        console.error('Error releasing database connection', {
          error: releaseError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

export async function initializeDatabase() {
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    console.log('Running in local development mode with SKIP_DB_VALIDATION - skipping database initialization');
    return;
  }
  
  // Connection retry parameters
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 3000; // 3 seconds
  
  // Function to retry database connection
  async function attemptDatabaseConnection(retryCount = 0) {
    try {
      console.log(`Database connection attempt ${retryCount + 1}/${MAX_RETRIES}...`);
      const result = await query('SELECT current_database() as db_name');
      console.log('Database connection verified:', {
        database: result.rows[0].db_name,
        poolSize: pool.totalCount,
        timestamp: new Date().toISOString()
      });
      return result;
    } catch (error) {
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`Connection failed, retrying in ${RETRY_DELAY_MS}ms...`, {
          error: error.message,
          attempt: retryCount + 1,
          timestamp: new Date().toISOString()
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return attemptDatabaseConnection(retryCount + 1);
      } else {
        console.error('Maximum connection retry attempts reached');
        throw error;
      }
    }
  }
  
  try {
    // Attempt to connect to database
    await attemptDatabaseConnection();
    
    // Check critical tables and create if missing
    console.log('Checking critical database tables...');
    
    // Check subscription_processing table specifically
    try {
      console.log('Checking for subscription_processing table...');
      const tableCheckResult = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'subscription_processing'
        ) as exists;
      `);
      
      if (!tableCheckResult.rows[0].exists) {
        console.log('WARNING: subscription_processing table does not exist, attempting to create it...');
        try {
          // First check if subscriptions table exists as we need it for the foreign key
          const subscriptionsExists = await query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public'
              AND table_name = 'subscriptions'
            ) as exists;
          `);
          
          if (subscriptionsExists.rows[0].exists) {
            // Create subscription_processing table with FK reference to subscriptions
            await query(`
              CREATE TABLE IF NOT EXISTS subscription_processing (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                result JSONB DEFAULT '{}'::jsonb,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              
              CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id 
                ON subscription_processing(subscription_id);
              CREATE INDEX IF NOT EXISTS idx_subscription_processing_status 
                ON subscription_processing(status);
            `);
            console.log('Successfully created subscription_processing table and indexes.');
          } else {
            console.log('Cannot create subscription_processing table - subscriptions table does not exist.');
          }
        } catch (createError) {
          console.error('Failed to create subscription_processing table:', {
            message: createError.message,
            stack: createError.stack?.split('\n')[0]
          });
          // We'll continue initialization even if table creation fails
        }
      } else {
        console.log('subscription_processing table exists, proceeding with normal initialization.');
      }
    } catch (tableCheckError) {
      console.error('Error checking for subscription_processing table:', {
        message: tableCheckError.message
      });
      // Continue with initialization
    }
    
    console.log('Database initialization completed successfully.');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', {
      message: error.message,
      stack: error.stack?.split('\n')[0],
      timestamp: new Date().toISOString()
    });
    
    // In development mode, we might want to continue anyway
    if (isLocalDevelopment && process.env.CONTINUE_ON_DB_ERROR === 'true') {
      console.warn('Continuing startup despite database initialization failure (DEVELOPMENT MODE)');
      return false;
    }
    
    throw error;
  }
}

/**
 * Sets the RLS context for the current database session
 * @param {string} userId - The user ID to set in the RLS context
 * @returns {Promise<void>}
 */
export async function setRLSContext(userId) {
  if (!userId) {
    console.warn('Attempted to set RLS context without a user ID');
    return;
  }
  
  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    console.log('DEVELOPMENT MODE: Skipping RLS context setting');
    return;
  }
  
  // Validate that userId is a valid UUID to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('Invalid UUID format for RLS context', { userId });
    throw new Error('Invalid UUID format for user ID');
  }
  
  try {
    // Use a string literal instead of parameterized query for SET LOCAL
    await query(`SET LOCAL app.current_user_id = '${userId}'`, []);
    console.log('Set RLS context successfully:', {
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to set RLS context:', {
      error: error.message,
      userId,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Database operation failed: ${error.message}`);
  }
}

/**
 * Executes a callback function with the RLS context set for a specific user
 * @param {string} userId - The user ID to set in the RLS context
 * @param {Function} callback - The function to execute within the RLS context
 * @returns {Promise<any>} - The result of the callback function
 */
export async function withRLSContext(userId, callback) {
  if (!userId) {
    throw new Error('User ID is required for RLS context');
  }
  
  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    console.log('DEVELOPMENT MODE: Skipping RLS context for callback execution');
    return await callback({ query: async (text, params) => ({ rows: [], rowCount: 0 }) });
  }
  
  // Validate that userId is a valid UUID to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('Invalid UUID format for user ID');
  }
  
  const client = await pool.connect();
  try {
    // Use a string literal instead of parameterized query for SET LOCAL
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`, []);
    return await callback(client);
  } finally {
    client.release();
  }
}

/**
 * Executes a callback function within a database transaction with RLS context set
 * This ensures atomicity for complex database operations
 * 
 * @param {string} userId - The user ID to set in the RLS context
 * @param {Function} callback - The function to execute within the transaction
 * @param {Object} [options] - Options for the transaction
 * @param {Object} [options.logger] - Logger to use for logging transaction details 
 * @param {string} [options.context] - Context information for logging
 * @param {string} [options.isolationLevel] - Transaction isolation level (READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
 * @returns {Promise<any>} - The result of the callback function
 */
export async function withTransaction(userId, callback, options = {}) {
  const { logger, context, isolationLevel = 'READ COMMITTED' } = options;
  const log = (level, message, details = {}) => {
    if (logger && logger[level]) {
      logger[level](context, message, details);
    } else {
      console[level === 'error' ? 'error' : 'log'](`Transaction ${message}:`, {
        userId,
        ...details,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Skip in development mode with validation disabled
  if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
    log('info', 'Skipping transaction in development mode');
    return await callback({ 
      query: async (text, params) => ({ rows: [], rowCount: 0 }),
      isInTransaction: true
    });
  }
  
  // Validate that userId is a valid UUID to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId && !uuidRegex.test(userId)) {
    throw new Error('Invalid UUID format for user ID');
  }
  
  // Validate isolation level
  const validIsolationLevels = ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
  if (!validIsolationLevels.includes(isolationLevel)) {
    log('info', `Invalid isolation level "${isolationLevel}", using default "READ COMMITTED"`);
    options.isolationLevel = 'READ COMMITTED';
  }
  
  const client = await pool.connect();
  
  try {
    log('info', `Starting transaction with isolation level ${isolationLevel}`);
    await client.query('BEGIN');
    
    // Set transaction isolation level
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    
    // Set RLS context if userId is provided
    if (userId) {
      await client.query(`SET LOCAL app.current_user_id = '${userId}'`, []);
      log('info', 'Set RLS context for transaction');
    }
    
    // Create a transaction client object containing the bound query method
    const txClient = {
      query: client.query.bind(client), // Explicitly pass the bound query method
      isInTransaction: true,
      isolationLevel
      // Add other client properties if needed by callbacks, e.g., client.escapeIdentifier
    };
    
    // Execute the callback within the transaction
    const result = await callback(txClient);
    
    // Only commit if the client hasn't already committed - this allows for explicit commits
    if (!client.connection._ending) {
      await client.query('COMMIT');
      log('info', 'Transaction committed successfully');
    } else {
      log('info', 'Transaction already committed by client');
    }
    
    return result;
  } catch (error) {
    try {
      // Only rollback if the client hasn't already committed/rolled back
      if (!client.connection._ending) {
        await client.query('ROLLBACK');
        log('error', 'Transaction rolled back due to error', {
          error: error.message,
          code: error.code,
          detail: error.detail
        });
      } else {
        log('info', 'Transaction already ended - skipping rollback');
      }
    } catch (rollbackError) {
      log('error', 'Failed to rollback transaction', {
        error: rollbackError.message,
        originalError: error.message
      });
    }
    
    // Rethrow the original error
    throw error;
  } finally {
    // Only release if the client is still available
    if (client.connection && !client.connection._ending) {
      client.release();
      log('info', 'Transaction client released');
    } else {
      log('info', 'Client already released/closed');
    }
  }
}