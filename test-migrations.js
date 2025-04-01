/**
 * Migration Test Script
 * 
 * This script tests the database migrations against a local PostgreSQL database.
 * It can import a SQL dump and then run the migrations to verify they work correctly.
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { initializeMigrations } from './src/infrastructure/database/safe-migrations.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const DB_NAME = process.env.DB_NAME || 'nifya';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';

const SQL_DUMP_PATH = './RealSQL/nifya.sql';

/**
 * Execute a shell command
 */
function executeCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    if (options.silent) {
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    process.on('close', (code) => {
      if (code !== 0) {
        if (options.silent) {
          console.error(`Command failed with code ${code}: ${stderr}`);
        }
        reject(new Error(`Command failed with code ${code}`));
        return;
      }
      
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Check if PostgreSQL is running
 */
async function checkPostgres() {
  try {
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-c', 'SELECT 1'
    ], { env: { PGPASSWORD: DB_PASSWORD }, silent: true });
    
    console.log('✅ PostgreSQL is running');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL is not running or credentials are incorrect');
    return false;
  }
}

/**
 * Check if test database exists
 */
async function databaseExists() {
  try {
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-c', 'SELECT 1'
    ], { env: { PGPASSWORD: DB_PASSWORD }, silent: true });
    
    console.log(`✅ Database '${DB_NAME}' exists`);
    return true;
  } catch (error) {
    console.log(`Database '${DB_NAME}' does not exist or is not accessible`);
    return false;
  }
}

/**
 * Create a fresh test database
 */
async function createTestDatabase() {
  // Drop the database if it exists
  try {
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-c', `DROP DATABASE IF EXISTS ${DB_NAME}`
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log(`✅ Database '${DB_NAME}' dropped (if it existed)`);
  } catch (error) {
    console.error(`Failed to drop database: ${error.message}`);
  }
  
  // Create a fresh database
  try {
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-c', `CREATE DATABASE ${DB_NAME}`
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log(`✅ Database '${DB_NAME}' created`);
  } catch (error) {
    console.error(`Failed to create database: ${error.message}`);
    throw error;
  }
}

/**
 * Import SQL dump
 */
async function importSqlDump() {
  try {
    // Check if dump file exists
    await fs.access(SQL_DUMP_PATH);
    
    // Import the SQL dump
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-f', SQL_DUMP_PATH
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log(`✅ SQL dump imported from ${SQL_DUMP_PATH}`);
  } catch (error) {
    console.error(`Failed to import SQL dump: ${error.message}`);
    throw error;
  }
}

/**
 * Run migrations
 */
async function runMigrations() {
  console.log('Running migrations...');
  
  try {
    await initializeMigrations({
      requestId: 'test-migrations',
      path: 'test-script',
      method: 'TEST'
    });
    
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migrations failed:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== Testing Database Migrations ===');
    
    // Check if PostgreSQL is running
    if (!(await checkPostgres())) {
      console.error('Please ensure PostgreSQL is running and credentials are correct');
      process.exit(1);
    }
    
    // Create a fresh test database
    await createTestDatabase();
    
    // Import SQL dump if specified
    if (await fs.access(SQL_DUMP_PATH).then(() => true).catch(() => false)) {
      await importSqlDump();
    } else {
      console.log(`SQL dump file not found at ${SQL_DUMP_PATH}, starting with empty database`);
    }
    
    // Run migrations
    await runMigrations();
    
    console.log('\n✅ Migration test completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration test failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();