/**
 * Migration Test Script
 * 
 * This script tests the enhanced startup migration functionality against a database.
 * It addresses the issues found in the logs, especially around dependencies
 * like current_user_id() function and is_system column.
 */

import dotenv from 'dotenv';
dotenv.config();

// Ensure we're using the startup migration
process.env.USE_STARTUP_MIGRATION = 'true';

// Import database client and migration function
import { pool } from './src/infrastructure/database/client.js';
import { runStartupMigration } from './src/infrastructure/database/startup-migration.js';

/**
 * Helper function to execute a query
 */
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get current database schema information
 */
async function getDatabaseInfo() {
  // Get tables
  const tables = await executeQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  
  // Get notification table columns
  const notificationColumns = await executeQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
    ORDER BY ordinal_position
  `);
  
  // Get user table columns
  const userColumns = await executeQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  
  // Get subscription_types table columns
  const subscriptionTypeColumns = await executeQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscription_types'
    ORDER BY ordinal_position
  `);
  
  // Check for current_user_id function
  let hasCurrentUserIdFunction = false;
  try {
    const functionResult = await executeQuery(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'current_user_id'
    `);
    hasCurrentUserIdFunction = functionResult.length > 0;
  } catch (error) {
    console.log('Error checking for current_user_id function');
  }
  
  // Check for RLS policies
  let rlsPolicies = [];
  try {
    rlsPolicies = await executeQuery(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
    `);
  } catch (error) {
    console.log('Error checking for RLS policies');
  }
  
  // Get migration history
  let migrationHistory = [];
  try {
    migrationHistory = await executeQuery(`
      SELECT version, applied_at, description
      FROM schema_version
      ORDER BY applied_at
    `);
  } catch (error) {
    console.log('schema_version table doesn\'t exist yet');
  }
  
  return {
    tables: tables.map(t => t.table_name),
    notificationColumns: notificationColumns.map(col => `${col.column_name} (${col.data_type})`),
    userColumns: userColumns.map(col => `${col.column_name} (${col.data_type})`),
    subscriptionTypeColumns: subscriptionTypeColumns.map(col => `${col.column_name} (${col.data_type})`),
    hasCurrentUserIdFunction,
    rlsPolicies: rlsPolicies.map(p => `${p.tablename}.${p.policyname}`),
    migrationHistory
  };
}

/**
 * Main test function
 */
async function testMigration() {
  try {
    console.log('=== Enhanced Migration Test ===');
    console.log('Connected to database:', process.env.DB_NAME);
    
    // Get database state before migration
    console.log('\nDatabase state BEFORE migration:');
    const beforeState = await getDatabaseInfo();
    console.log('- Tables:', beforeState.tables.length ? beforeState.tables.join(', ') : 'None');
    
    // Check for critical requirements before migration
    console.log('\n- Critical Functions:');
    console.log(`  - current_user_id function: ${beforeState.hasCurrentUserIdFunction ? '✅ Present' : '❌ Missing'}`);
    
    // Check for RLS policies
    console.log('\n- RLS Policies:');
    if (beforeState.rlsPolicies.length) {
      beforeState.rlsPolicies.forEach(policy => console.log(`  - ${policy}`));
    } else {
      console.log('  - None found');
    }
    
    // Check subscription_types table columns (including is_system)
    if (beforeState.subscriptionTypeColumns.length) {
      console.log('\n- Subscription Types columns:');
      beforeState.subscriptionTypeColumns.forEach(col => console.log(`  - ${col}`));
      
      // Check specifically for is_system column
      const hasIsSystemColumn = beforeState.subscriptionTypeColumns.some(col => col.startsWith('is_system'));
      console.log(`  - is_system column: ${hasIsSystemColumn ? '✅ Present' : '❌ Missing'}`);
    } else {
      console.log('\n- Subscription Types table: Not found');
    }
    
    if (beforeState.notificationColumns.length) {
      console.log('\n- Notification columns:');
      beforeState.notificationColumns.forEach(col => console.log(`  - ${col}`));
    }
    
    if (beforeState.userColumns.length) {
      console.log('\n- User columns:');
      beforeState.userColumns.forEach(col => console.log(`  - ${col}`));
    }
    
    console.log('\n- Migration history:', 
      beforeState.migrationHistory.length 
        ? beforeState.migrationHistory.map(m => `${m.version} (${new Date(m.applied_at).toISOString()})`)
        : 'None'
    );
    
    // Run the migration
    console.log('\nRunning enhanced migration...');
    const success = await runStartupMigration();
    
    if (success) {
      console.log('✅ Migration completed successfully');
    } else {
      console.log('❌ Migration failed');
      return;
    }
    
    // Get database state after migration
    console.log('\nDatabase state AFTER migration:');
    const afterState = await getDatabaseInfo();
    
    console.log('- Tables:', afterState.tables.length ? afterState.tables.join(', ') : 'None');
    
    // Check for critical requirements after migration
    console.log('\n- Critical Functions:');
    console.log(`  - current_user_id function: ${afterState.hasCurrentUserIdFunction ? '✅ Present' : '❌ Still missing!'}`);
    
    // Check for RLS policies after migration
    console.log('\n- RLS Policies:');
    if (afterState.rlsPolicies.length) {
      afterState.rlsPolicies.forEach(policy => console.log(`  - ${policy}`));
    } else {
      console.log('  - None found (potential issue)');
    }
    
    // Check subscription_types table columns after migration
    if (afterState.subscriptionTypeColumns.length) {
      console.log('\n- Subscription Types columns:');
      afterState.subscriptionTypeColumns.forEach(col => console.log(`  - ${col}`));
      
      // Check specifically for is_system column
      const hasIsSystemColumn = afterState.subscriptionTypeColumns.some(col => col.startsWith('is_system'));
      console.log(`  - is_system column: ${hasIsSystemColumn ? '✅ Present' : '❌ Still missing!'}`);
    }
    
    if (afterState.notificationColumns.length) {
      console.log('\n- Notification columns:');
      afterState.notificationColumns.forEach(col => console.log(`  - ${col}`));
    }
    
    if (afterState.userColumns.length) {
      console.log('\n- User columns:');
      afterState.userColumns.forEach(col => console.log(`  - ${col}`));
    }
    
    console.log('\n- Migration history:');
    afterState.migrationHistory.forEach(m => {
      console.log(`  - ${m.version} (${new Date(m.applied_at).toISOString()}): ${m.description || 'No description'}`);
    });
    
    // Show changes
    console.log('\n=== Migration Changes ===');
    
    // New tables
    const newTables = afterState.tables.filter(t => !beforeState.tables.includes(t));
    if (newTables.length) {
      console.log('- New tables:', newTables.join(', '));
    }
    
    // Function changes
    if (!beforeState.hasCurrentUserIdFunction && afterState.hasCurrentUserIdFunction) {
      console.log('- Added current_user_id function ✅');
    }
    
    // RLS policy changes
    const newPolicies = afterState.rlsPolicies.filter(p => !beforeState.rlsPolicies.includes(p));
    if (newPolicies.length) {
      console.log('- Added RLS policies:', newPolicies.join(', '));
    }
    
    // Subscription type column changes
    const beforeSubTypeCols = beforeState.subscriptionTypeColumns.map(c => c.split(' ')[0]);
    const afterSubTypeCols = afterState.subscriptionTypeColumns.map(c => c.split(' ')[0]);
    const newSubTypeCols = afterSubTypeCols.filter(c => !beforeSubTypeCols.includes(c));
    
    if (newSubTypeCols.length) {
      console.log('- New subscription_types columns:', newSubTypeCols.join(', '));
    }
    
    // New notification columns
    const beforeNotifCols = beforeState.notificationColumns.map(c => c.split(' ')[0]);
    const afterNotifCols = afterState.notificationColumns.map(c => c.split(' ')[0]);
    const newNotifCols = afterNotifCols.filter(c => !beforeNotifCols.includes(c));
    
    if (newNotifCols.length) {
      console.log('- New notification columns:', newNotifCols.join(', '));
    }
    
    // New user columns
    const beforeUserCols = beforeState.userColumns.map(c => c.split(' ')[0]);
    const afterUserCols = afterState.userColumns.map(c => c.split(' ')[0]);
    const newUserCols = afterUserCols.filter(c => !beforeUserCols.includes(c));
    
    if (newUserCols.length) {
      console.log('- New user columns:', newUserCols.join(', '));
    }
    
    // New migrations
    const beforeVersions = beforeState.migrationHistory.map(m => m.version);
    const afterVersions = afterState.migrationHistory.map(m => m.version);
    const newVersions = afterVersions.filter(v => !beforeVersions.includes(v));
    
    if (newVersions.length) {
      console.log('- New migrations applied:', newVersions.join(', '));
    }
    
    // Check if all issues were fixed
    console.log('\n=== Migration Success Verification ===');
    console.log(`- current_user_id function: ${afterState.hasCurrentUserIdFunction ? '✅ Fixed' : '❌ Still missing'}`);
    
    const hasIsSystemColumn = afterState.subscriptionTypeColumns.some(col => col.startsWith('is_system'));
    console.log(`- is_system column: ${hasIsSystemColumn ? '✅ Fixed' : '❌ Still missing'}`);
    
    console.log(`- RLS policies: ${afterState.rlsPolicies.length > 0 ? '✅ Present' : '❌ Missing'}`);
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run the test
testMigration();