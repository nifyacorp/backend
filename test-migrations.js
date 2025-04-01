/**
 * Test script for verifying migration integrity
 * 
 * This script validates database migrations without actually applying them.
 * It checks for SQL syntax errors and other common issues.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'supabase/migrations');

// Create temporary test database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 1 // Use only one connection
});

/**
 * Check if SQL is valid by parsing it
 */
async function validateSqlSyntax(sql, filename) {
  // Create temporary transaction and roll it back
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Set to read-only mode to prevent accidental changes
    await client.query('SET TRANSACTION READ ONLY');
    
    try {
      // Execute a EXPLAIN to parse the SQL without executing it
      // Note: This only works for SELECT statements, so we'll use a different approach
      
      // Try to execute the SQL in a savepoint we can roll back
      await client.query('SAVEPOINT syntax_check');
      
      // Add DO block around statements that don't return results
      const wrappedSql = `
        DO $$
        BEGIN
          -- Original SQL follows:
          ${sql}
          -- End of original SQL
        EXCEPTION WHEN OTHERS THEN
          -- Catch exceptions and re-raise with context
          RAISE EXCEPTION 'SQL syntax error in %: %', '${filename.replace(/'/g, "''")}', SQLERRM;
        END;
        $$;
      `;
      
      await client.query(wrappedSql);
      await client.query('RELEASE SAVEPOINT syntax_check');
      
      return { valid: true };
    } catch (error) {
      // Roll back to savepoint
      if (client.query) {
        await client.query('ROLLBACK TO SAVEPOINT syntax_check');
      }
      
      // Extract useful information from the error
      return {
        valid: false,
        message: error.message,
        detail: error.detail,
        hint: error.hint,
        position: error.position
      };
    }
  } finally {
    // Always roll back the transaction and release the client
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      console.error('Error rolling back transaction:', e);
    }
    client.release();
  }
}

/**
 * Check for common SQL issues in migrations
 */
function checkForCommonIssues(sql, filename) {
  const issues = [];
  
  // Check for unquoted JSON keys or values
  const jsonPatterns = [
    { pattern: /DEFAULT\s+{[^}]*}\s*::jsonb/g, message: 'Unquoted JSON literal (should be DEFAULT \'{"key":"value"}\'::jsonb)' },
    { pattern: /DEFAULT\s+{[^}]*}\s*::json/g, message: 'Unquoted JSON literal (should be DEFAULT \'{"key":"value"}\'::json)' },
    { pattern: /=\s+{[^}]*}\s*::jsonb/g, message: 'Unquoted JSON literal (should be = \'{"key":"value"}\'::jsonb)' },
    { pattern: /=\s+{[^}]*}\s*::json/g, message: 'Unquoted JSON literal (should be = \'{"key":"value"}\'::json)' }
  ];
  
  for (const { pattern, message } of jsonPatterns) {
    if (pattern.test(sql)) {
      issues.push({ type: 'json_syntax', message });
    }
  }
  
  // Check for non-idempotent operations without guards
  if (
    sql.includes('CREATE TABLE') && 
    !sql.includes('IF NOT EXISTS') && 
    !sql.includes('DO $$') // Allow if it's in a PL/pgSQL block that might have its own checks
  ) {
    issues.push({ type: 'not_idempotent', message: 'CREATE TABLE without IF NOT EXISTS can fail if table already exists' });
  }
  
  if (
    sql.includes('CREATE INDEX') && 
    !sql.includes('IF NOT EXISTS') &&
    !sql.includes('DO $$')
  ) {
    issues.push({ type: 'not_idempotent', message: 'CREATE INDEX without IF NOT EXISTS can fail if index already exists' });
  }
  
  // Check for potential RLS issues
  if (sql.includes('ENABLE ROW LEVEL SECURITY') && !sql.includes('CREATE POLICY')) {
    issues.push({ type: 'rls_warning', message: 'RLS enabled but no policies created - table might be inaccessible' });
  }
  
  // Check for concatenation in SQL that might be unsafe
  const badConcatenation = /\|\|\s*([^'].*?['"]|[^"].*?['"])/g;
  if (badConcatenation.test(sql)) {
    issues.push({ type: 'potentially_unsafe', message: 'SQL concatenation may need parentheses to avoid precedence issues' });
  }
  
  return issues;
}

/**
 * Main function to validate all migrations
 */
async function validateMigrations() {
  console.log(`\n🔍 Validating migrations in ${MIGRATIONS_DIR}\n`);
  
  try {
    // Get all migration files
    const files = await fs.readdir(MIGRATIONS_DIR);
    
    // Filter for SQL files and sort
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    let hasErrors = false;
    let totalIssues = 0;
    
    // Check each migration file
    for (const filename of migrationFiles) {
      console.log(`Checking ${filename}...`);
      
      // Read the file
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = await fs.readFile(filePath, 'utf-8');
      
      // Validate SQL syntax
      const syntaxResult = await validateSqlSyntax(sql, filename);
      if (!syntaxResult.valid) {
        console.error(`❌ SQL syntax error in ${filename}:`);
        console.error(`   ${syntaxResult.message}`);
        if (syntaxResult.position) {
          // Calculate line number from position
          const lines = sql.substring(0, parseInt(syntaxResult.position, 10)).split('\n');
          const lineNumber = lines.length;
          console.error(`   Error near line ${lineNumber}`);
        }
        if (syntaxResult.hint) {
          console.error(`   Hint: ${syntaxResult.hint}`);
        }
        hasErrors = true;
        totalIssues++;
      }
      
      // Check for common issues
      const issues = checkForCommonIssues(sql, filename);
      if (issues.length > 0) {
        console.warn(`⚠️ Potential issues in ${filename}:`);
        issues.forEach(issue => {
          console.warn(`   - ${issue.message}`);
        });
        totalIssues += issues.length;
      }
      
      if (!syntaxResult.valid || issues.length > 0) {
        console.log('');
      } else {
        console.log(`✅ No issues found\n`);
      }
    }
    
    // Summary
    if (hasErrors) {
      console.error(`\n❌ Validation failed with ${totalIssues} issue(s). Please fix the errors before deploying.`);
      process.exit(1);
    } else if (totalIssues > 0) {
      console.warn(`\n⚠️ Validation completed with ${totalIssues} warning(s). Please review before deploying.`);
      process.exit(0);
    } else {
      console.log(`\n✅ All migrations passed validation successfully!`);
      process.exit(0);
    }
  } catch (error) {
    console.error('Error validating migrations:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the validation
validateMigrations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});