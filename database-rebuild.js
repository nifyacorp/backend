/**
 * Database Rebuild Script
 * 
 * This script completely rebuilds the database using a single schema file
 * and migrates data from an existing database dump.
 * 
 * Usage:
 *   node database-rebuild.js [--with-data] [--dump-file=path/to/dump.sql]
 * 
 * Options:
 *   --with-data: Import data from the old database after creating the schema
 *   --dump-file: Path to the SQL dump file (default: ./RealSQL/nifya.sql)
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Configuration
const DB_NAME = process.env.DB_NAME || 'nifya';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';

const SCHEMA_FILE = './supabase/complete-schema.sql';
const DEFAULT_DUMP_FILE = './RealSQL/nifya.sql';

// Parse command line arguments
const args = process.argv.slice(2);
const withData = args.includes('--with-data');
const dumpFileArg = args.find(arg => arg.startsWith('--dump-file='));
const dumpFile = dumpFileArg 
  ? dumpFileArg.split('=')[1] 
  : DEFAULT_DUMP_FILE;

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
 * Create a backup of the current database
 */
async function backupCurrentDatabase() {
  try {
    const backupFile = `nifya_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    
    console.log(`Creating backup of current database to ${backupFile}...`);
    
    await executeCommand('pg_dump', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-f', backupFile
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log(`✅ Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.warn(`⚠️ Could not create backup: ${error.message}`);
    return null;
  }
}

/**
 * Drop and recreate the database
 */
async function resetDatabase() {
  try {
    // Connect to postgres database to drop/create our target database
    console.log(`Connecting to PostgreSQL to drop and recreate ${DB_NAME}...`);
    
    // Drop database
    try {
      await executeCommand('psql', [
        '-h', DB_HOST,
        '-p', DB_PORT,
        '-U', DB_USER,
        '-d', 'postgres',
        '-c', `DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`
      ], { env: { PGPASSWORD: DB_PASSWORD } });
      
      console.log(`✅ Dropped database ${DB_NAME}`);
    } catch (error) {
      console.error(`Failed to drop database: ${error.message}`);
      // Try a different approach
      console.log('Trying alternative approach to drop database...');
      
      try {
        // Kill existing connections
        await executeCommand('psql', [
          '-h', DB_HOST,
          '-p', DB_PORT,
          '-U', DB_USER,
          '-d', 'postgres',
          '-c', `
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '${DB_NAME}'
            AND pid <> pg_backend_pid();
          `
        ], { env: { PGPASSWORD: DB_PASSWORD } });
        
        // Now try again
        await executeCommand('psql', [
          '-h', DB_HOST,
          '-p', DB_PORT,
          '-U', DB_USER,
          '-d', 'postgres',
          '-c', `DROP DATABASE IF EXISTS ${DB_NAME}`
        ], { env: { PGPASSWORD: DB_PASSWORD } });
        
        console.log(`✅ Dropped database ${DB_NAME} after killing connections`);
      } catch (error2) {
        console.error(`Still failed to drop database: ${error2.message}`);
        throw error2;
      }
    }
    
    // Create database
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', 'postgres',
      '-c', `CREATE DATABASE ${DB_NAME}`
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log(`✅ Created fresh database ${DB_NAME}`);
    
    return true;
  } catch (error) {
    console.error(`Failed to reset database: ${error.message}`);
    throw error;
  }
}

/**
 * Apply the complete schema
 */
async function applySchema() {
  try {
    console.log(`Applying complete schema from ${SCHEMA_FILE}...`);
    
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-f', SCHEMA_FILE
    ], { env: { PGPASSWORD: DB_PASSWORD } });
    
    console.log('✅ Schema applied successfully');
    return true;
  } catch (error) {
    console.error(`Failed to apply schema: ${error.message}`);
    throw error;
  }
}

/**
 * Extract and import data from dump file
 */
async function importDataFromDump() {
  try {
    console.log(`Importing data from ${dumpFile}...`);
    
    // First check if dump file exists
    await fs.access(dumpFile);
    
    // Create temp directory for extracted data
    const tempDir = './temp_data';
    try {
      await fs.mkdir(tempDir);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Extract data from each table in the dump file
    const tables = [
      'users',
      'user_email_preferences',
      'subscription_types',
      'subscription_templates',
      'subscriptions',
      'subscription_processing',
      'notifications'
    ];
    
    for (const table of tables) {
      const outputFile = path.join(tempDir, `${table}.sql`);
      
      console.log(`Extracting data for ${table}...`);
      
      try {
        // Extract COPY statements for this table
        await executeCommand('grep', [
          '-A', '1000',
          `COPY public.${table}`,
          dumpFile,
          '|',
          'sed', '-n',
          `'/COPY public.${table}/,/\\\\\\./p'`,
          '>', outputFile
        ], { shell: true });
        
        // Check if we got any data
        const stats = await fs.stat(outputFile);
        
        if (stats.size > 0) {
          console.log(`✅ Extracted data for ${table}`);
          
          // Import the data to the database
          await executeCommand('psql', [
            '-h', DB_HOST,
            '-p', DB_PORT,
            '-U', DB_USER,
            '-d', DB_NAME,
            '-c', `\\i ${outputFile}`
          ], { env: { PGPASSWORD: DB_PASSWORD } });
          
          console.log(`✅ Imported data for ${table}`);
        } else {
          console.log(`⚠️ No data found for ${table}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to extract or import data for ${table}: ${error.message}`);
      }
    }
    
    // Clean up
    try {
      console.log('Cleaning up temporary files...');
      for (const table of tables) {
        const file = path.join(tempDir, `${table}.sql`);
        await fs.unlink(file).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
    } catch (error) {
      console.warn(`⚠️ Failed to clean up: ${error.message}`);
    }
    
    console.log('✅ Data import completed');
    return true;
  } catch (error) {
    console.error(`Failed to import data: ${error.message}`);
    throw error;
  }
}

/**
 * Generate sequence reset commands for each table with a sequence
 */
async function resetSequences() {
  try {
    console.log('Resetting sequences...');
    
    // Get all sequences in the database
    const sequencesResult = await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-t', // Tuples only
      '-c', "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'"
    ], { env: { PGPASSWORD: DB_PASSWORD }, silent: true });
    
    const sequences = sequencesResult.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (sequences.length === 0) {
      console.log('No sequences to reset');
      return true;
    }
    
    console.log(`Found ${sequences.length} sequences to reset`);
    
    // Generate and execute SETVAL commands for each sequence
    for (const sequence of sequences) {
      // Infer table and column from sequence name (typical naming convention: table_column_seq)
      const parts = sequence.split('_');
      const columnName = parts[parts.length - 2];
      const tableName = parts.slice(0, -2).join('_');
      
      // Generate command to get max value
      const command = `
        SELECT SETVAL('${sequence}', COALESCE((SELECT MAX(${columnName}) FROM ${tableName}), 1));
      `;
      
      try {
        await executeCommand('psql', [
          '-h', DB_HOST,
          '-p', DB_PORT,
          '-U', DB_USER,
          '-d', DB_NAME,
          '-c', command
        ], { env: { PGPASSWORD: DB_PASSWORD } });
        
        console.log(`✅ Reset sequence ${sequence}`);
      } catch (error) {
        console.warn(`⚠️ Failed to reset sequence ${sequence}: ${error.message}`);
      }
    }
    
    console.log('✅ Sequence reset completed');
    return true;
  } catch (error) {
    console.error(`Failed to reset sequences: ${error.message}`);
    // Non-fatal error
    return false;
  }
}

/**
 * Check database connection
 */
async function checkConnection() {
  try {
    await executeCommand('psql', [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-c', 'SELECT 1'
    ], { env: { PGPASSWORD: DB_PASSWORD }, silent: true });
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed');
    return false;
  }
}

/**
 * Ask for user confirmation
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(`${message} (y/N) `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('=== NIFYA Database Rebuild ===');
  
  // Check database connection
  if (!(await checkConnection())) {
    console.error('Please check your database credentials and try again.');
    process.exit(1);
  }
  
  // Confirm before proceeding
  console.log('\n⚠️ WARNING: This will completely rebuild your database!');
  console.log('All existing data will be lost unless you use the --with-data option.');
  
  const confirmed = await confirm('Are you sure you want to continue?');
  
  if (!confirmed) {
    console.log('Operation canceled.');
    process.exit(0);
  }
  
  try {
    // Backup current database
    const backupFile = await backupCurrentDatabase();
    
    if (backupFile) {
      console.log(`If something goes wrong, you can restore from: ${backupFile}`);
    }
    
    // Reset database
    await resetDatabase();
    
    // Apply schema
    await applySchema();
    
    // Import data if requested
    if (withData) {
      await importDataFromDump();
      await resetSequences();
    }
    
    console.log('\n✅ Database rebuild completed successfully!');
    console.log(`The database "${DB_NAME}" now has a clean schema.`);
    
    if (withData) {
      console.log('Data from the old database has been imported.');
    } else {
      console.log('This is a fresh database with no data.');
    }
    
    console.log('\nNext steps:');
    console.log('1. Update your application to use the new schema');
    console.log('2. Remove old migration files from supabase/migrations/');
    console.log('3. Copy complete-schema.sql to supabase/migrations/YYYYMMDD000000_complete_schema.sql');
  } catch (error) {
    console.error('\n❌ Database rebuild failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();