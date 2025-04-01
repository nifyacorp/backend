/**
 * Migration Test Script
 * 
 * This script tests the startup migration functionality against a database.
 * It's useful for verifying migrations will work before deploying.
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
    migrationHistory
  };
}

/**
 * Main test function
 */
async function testMigration() {
  try {
    console.log('=== Migration Test ===');
    console.log('Connected to database:', process.env.DB_NAME);
    
    // Get database state before migration
    console.log('\nDatabase state BEFORE migration:');
    const beforeState = await getDatabaseInfo();
    console.log('- Tables:', beforeState.tables.length ? beforeState.tables.join(', ') : 'None');
    
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
    console.log('\nRunning migration...');
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