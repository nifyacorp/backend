/**
 * NIFYA Subscription Processing Table Fix Script
 * 
 * This script checks for the existence of the subscription_processing table
 * and creates it if it doesn't exist. It's designed to be run as a standalone
 * script to fix the 500 error when fetching subscription status.
 */

// Set environment variable to skip database validation for local development
process.env.SKIP_DB_VALIDATION = 'true';
process.env.CONTINUE_ON_DB_ERROR = 'true';

import { pool, query } from './infrastructure/database/client.js';
import { logInfo, logError } from './shared/logging/logger.js';

async function fixSubscriptionProcessingTable() {
  console.log('Starting subscription_processing table fix script...');
  
  try {
    // Check if the subscription_processing table exists
    const tableExistsResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'subscription_processing'
      ) as exists;
    `);
    
    const tableExists = tableExistsResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Subscription_processing table does not exist. Creating it now...');
      
      // Create the subscription_processing table
      await query(`
        CREATE TABLE IF NOT EXISTS subscription_processing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          result JSONB DEFAULT '{}'::jsonb,
          error_message TEXT,
          user_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id 
          ON subscription_processing(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_subscription_processing_status 
          ON subscription_processing(status);
      `);
      
      console.log('Subscription_processing table created successfully');
    } else {
      console.log('Subscription_processing table already exists. Checking for missing columns...');
      
      // Check if user_id column exists
      const userIdColumnExistsResult = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'subscription_processing'
          AND column_name = 'user_id'
        ) as exists;
      `);
      
      const userIdColumnExists = userIdColumnExistsResult.rows[0].exists;
      
      if (!userIdColumnExists) {
        console.log('Adding user_id column to subscription_processing table...');
        
        // Add user_id column if it doesn't exist
        await query(`
          ALTER TABLE subscription_processing 
          ADD COLUMN user_id UUID;
        `);
        
        console.log('user_id column added successfully');
      } else {
        console.log('user_id column already exists');
      }
    }

    // Additional verification
    const countResult = await query('SELECT COUNT(*) FROM subscription_processing');
    console.log(`Current subscription_processing table has ${countResult.rows[0].count} records`);
    
    console.log('Fix script completed successfully');
  } catch (error) {
    console.error('Error fixing subscription_processing table:', error);
  } finally {
    // Close database connection
    try {
      await pool.end();
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the fix script
fixSubscriptionProcessingTable(); 