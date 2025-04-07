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
import { logError } from './shared/logging/logger.js';

async function fixSubscriptionProcessingTable() {
  console.log('Starting subscription_processing table fix script...');
  
  try {
    // Check if subscription_processing table exists
    console.log('Checking for subscription_processing table...');
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'subscription_processing'
      ) as exists;
    `);
    
    if (!tableCheckResult.rows[0].exists) {
      console.log('subscription_processing table does not exist, creating it now...');
      
      // Check if subscriptions table exists (needed for foreign key)
      const subscriptionsTableExists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
        ) as exists;
      `);
      
      if (!subscriptionsTableExists.rows[0].exists) {
        console.error('ERROR: Cannot create subscription_processing table because subscriptions table does not exist!');
        return;
      }
      
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
      
      console.log('Successfully created subscription_processing table and indexes!');
      
      // Verify the table was created
      const verifyResult = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'subscription_processing'
        ) as exists;
      `);
      
      if (verifyResult.rows[0].exists) {
        console.log('✅ Verification successful: subscription_processing table exists.');
      } else {
        console.error('❌ Verification failed: subscription_processing table was not created!');
      }
      
    } else {
      console.log('subscription_processing table already exists, no action needed.');
    }
    
  } catch (error) {
    console.error('Error fixing subscription_processing table:', error);
  } finally {
    // Close database connection
    try {
      await pool.end();
      console.log('Database connection closed.');
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the fix function
fixSubscriptionProcessingTable(); 