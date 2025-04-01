/**
 * Migration Analyzer
 * 
 * This script analyzes migration files and a SQL dump to identify potential issues
 * without requiring a running PostgreSQL instance.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current module's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to migrations directory and SQL dump
const MIGRATIONS_DIR = path.join(__dirname, 'supabase/migrations');
const SQL_DUMP_PATH = path.join(__dirname, '..', 'RealSQL/nifya.sql');

/**
 * Read all migration files
 */
async function readMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    const migrationFiles = files.filter(file => file.endsWith('.sql'));
    
    const migrations = [];
    
    for (const file of migrationFiles) {
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const version = file.split('_')[0];
      
      migrations.push({
        file,
        version,
        content
      });
    }
    
    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  } catch (error) {
    console.error('Error reading migration files:', error);
    return [];
  }
}

/**
 * Read SQL dump file
 */
async function readSqlDump() {
  try {
    return await fs.readFile(SQL_DUMP_PATH, 'utf-8');
  } catch (error) {
    console.error('Error reading SQL dump:', error);
    return '';
  }
}

/**
 * Extract schema_version entries from SQL dump
 */
function extractSchemaVersions(sqlDump) {
  const regex = /COPY public\.schema_version \(.*?\) FROM stdin;([\s\S]*?)\\./m;
  const match = sqlDump.match(regex);
  
  if (!match || !match[1]) {
    return [];
  }
  
  return match[1].trim().split('\n').map(line => {
    const fields = line.split('\t');
    return {
      version: fields[0],
      applied_at: fields[1],
      description: fields[2]
    };
  });
}

/**
 * Extract tables from SQL dump
 */
function extractTables(sqlDump) {
  const tableRegex = /CREATE TABLE public\.(\w+)/g;
  const tables = [];
  let match;
  
  while ((match = tableRegex.exec(sqlDump)) !== null) {
    tables.push(match[1]);
  }
  
  return tables;
}

/**
 * Check for conflicts between migrations and schema_version entries
 */
function checkForConflicts(migrations, schemaVersions) {
  const conflicts = [];
  
  for (const migration of migrations) {
    const matchingVersion = schemaVersions.find(sv => sv.version === migration.version);
    
    if (matchingVersion) {
      // For schema_version and migration_system_fix, this is expected
      if (migration.file.includes('create_schema_version') || 
          migration.file.includes('migration_system_fix')) {
        console.log(`ℹ️ Expected overlap: Migration ${migration.file} has matching schema_version record ${migration.version}`);
      } else {
        conflicts.push({
          migration: migration.file,
          version: migration.version,
          existing: matchingVersion
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Analyze migrations for potential issues
 */
function analyzeMigrations(migrations) {
  const issues = [];
  
  for (const migration of migrations) {
    // Check for missing IF NOT EXISTS in CREATE TABLE
    if (migration.content.includes('CREATE TABLE') && 
        !migration.content.includes('IF NOT EXISTS') && 
        !migration.content.includes('CREATE TABLE IF NOT EXISTS')) {
      issues.push({
        file: migration.file,
        issue: 'Missing IF NOT EXISTS in CREATE TABLE',
        type: 'warning'
      });
    }
    
    // Check for missing ON CONFLICT in INSERT INTO schema_version
    if (migration.content.includes('INSERT INTO schema_version') && 
        !migration.content.includes('ON CONFLICT')) {
      issues.push({
        file: migration.file,
        issue: 'Missing ON CONFLICT in INSERT INTO schema_version',
        type: 'error'
      });
    }
    
    // Check for ALTER TABLE without IF EXISTS
    if (migration.content.includes('ALTER TABLE') && 
        migration.content.includes('DROP COLUMN') && 
        !migration.content.includes('DROP COLUMN IF EXISTS')) {
      issues.push({
        file: migration.file,
        issue: 'Missing IF EXISTS in DROP COLUMN',
        type: 'warning'
      });
    }
    
    // Check for potential syntax errors
    if (migration.content.includes('BEGINL') || 
        migration.content.includes('COMIT') || 
        migration.content.includes('ROLBACK')) {
      issues.push({
        file: migration.file,
        issue: 'Potential syntax error',
        type: 'error'
      });
    }
  }
  
  return issues;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Analyzing migrations...');
  
  // Read migrations
  const migrations = await readMigrationFiles();
  console.log(`Found ${migrations.length} migration files`);
  
  // Read SQL dump
  const sqlDump = await readSqlDump();
  if (!sqlDump) {
    console.log('❌ SQL dump not found or empty');
    return;
  }
  
  console.log(`Read SQL dump (${sqlDump.length} bytes)`);
  
  // Extract schema_version entries from SQL dump
  const schemaVersions = extractSchemaVersions(sqlDump);
  console.log(`Found ${schemaVersions.length} schema_version entries in SQL dump`);
  
  // Extract tables from SQL dump
  const tables = extractTables(sqlDump);
  console.log(`Found ${tables.length} tables in SQL dump`);
  
  // Check for conflicts
  const conflicts = checkForConflicts(migrations, schemaVersions);
  
  // Analyze migrations for potential issues
  const issues = analyzeMigrations(migrations);
  
  // Print results
  console.log('\n=== Migration Analysis Results ===');
  
  // Print schema_version entries
  console.log('\n📋 Schema Version Entries:');
  for (const sv of schemaVersions) {
    console.log(`  - ${sv.version}: ${sv.description || 'No description'}`);
  }
  
  // Print conflicts
  console.log('\n🔄 Version Conflicts:');
  if (conflicts.length === 0) {
    console.log('  ✅ No conflicts found');
  } else {
    for (const conflict of conflicts) {
      console.log(`  ❗ Migration ${conflict.migration} conflicts with existing schema_version entry ${conflict.version}`);
    }
  }
  
  // Print issues
  console.log('\n⚠️ Potential Issues:');
  if (issues.length === 0) {
    console.log('  ✅ No issues found');
  } else {
    for (const issue of issues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`  ${icon} ${issue.file}: ${issue.issue}`);
    }
  }
  
  // Check special migrations
  const createSchemaVersionMigration = migrations.find(m => m.file.includes('create_schema_version'));
  const migrationSystemFixMigration = migrations.find(m => m.file.includes('migration_system_fix'));
  
  console.log('\n🧩 Special Migrations:');
  if (createSchemaVersionMigration) {
    console.log(`  ✅ Schema version creation migration found: ${createSchemaVersionMigration.file}`);
  } else {
    console.log('  ❌ Schema version creation migration missing');
  }
  
  if (migrationSystemFixMigration) {
    console.log(`  ✅ Migration system fix migration found: ${migrationSystemFixMigration.file}`);
  } else {
    console.log('  ❌ Migration system fix migration missing');
  }
  
  // Final summary
  console.log('\n=== Summary ===');
  console.log(`Total migrations: ${migrations.length}`);
  console.log(`Schema version entries: ${schemaVersions.length}`);
  console.log(`Conflicts: ${conflicts.length}`);
  console.log(`Issues: ${issues.length}`);
  
  if (conflicts.length === 0 && issues.length === 0) {
    console.log('\n✅ All looks good! Migrations should apply successfully.');
  } else {
    console.log('\n⚠️ Some issues were found. Please review the results above.');
  }
}

// Run the main function
main();