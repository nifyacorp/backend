/**
 * Migration to add Firebase UID column to users table
 */
import { query } from '../client.js';
import logger from '../../../shared/logger.js';

export async function migrate() {
  try {
    logger.logInfo({}, 'Starting migration: Add firebase_uid column to users table');
    
    // Check if the column already exists
    const columnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'firebase_uid'
    `);
    
    if (columnExists.rows.length === 0) {
      // Add firebase_uid column to users table
      await query(`
        ALTER TABLE users 
        ADD COLUMN firebase_uid VARCHAR(128) UNIQUE
      `);
      
      // Create index for firebase_uid
      await query(`
        CREATE INDEX IF NOT EXISTS idx_users_firebase_uid 
        ON users(firebase_uid)
      `);
      
      logger.logInfo({}, 'Added firebase_uid column and index to users table');
      
      // Update schema version
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
      const version = `${timestamp}_add_firebase_uid`;
      
      await query(`
        INSERT INTO schema_version (version, description)
        VALUES ($1, 'Add firebase_uid column to users table')
        ON CONFLICT (version) DO NOTHING
      `, [version]);
      
      logger.logInfo({}, 'Updated schema version for firebase_uid migration');
    } else {
      logger.logInfo({}, 'Column firebase_uid already exists in users table, skipping migration');
    }
    
    return true;
  } catch (error) {
    logger.logError({}, 'Error migrating firebase_uid column', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
} 