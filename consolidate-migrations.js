/**
 * Migration Consolidator
 * 
 * This script consolidates multiple migration files into a single consolidated file
 * to reduce the number of migrations that need to be run during initialization.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current module's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to migrations directory
const MIGRATIONS_DIR = path.join(__dirname, 'supabase/migrations');
const OUTPUT_DIR = MIGRATIONS_DIR;

// Today's date in YYYYMMDD format
const TODAY = new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Output filename
const CONSOLIDATED_FILENAME = `${TODAY}000000_consolidated_migrations.sql`;

/**
 * Read all migration files
 */
async function readMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        // Sort by version number (first part of filename)
        const versionA = a.split('_')[0];
        const versionB = b.split('_')[0];
        return versionA.localeCompare(versionB);
      });
    
    return migrationFiles;
  } catch (error) {
    console.error('Error reading migration files:', error);
    return [];
  }
}

/**
 * Consolidate migrations
 */
async function consolidateMigrations(cutoffDate) {
  try {
    const files = await readMigrationFiles();
    
    console.log(`Found ${files.length} migration files in total`);
    
    // Filter files by date (exclude recent files)
    const cutoffVersion = cutoffDate.replace(/-/g, '');
    const oldFiles = files.filter(file => {
      const version = file.split('_')[0];
      return version < cutoffVersion;
    });
    
    const newFiles = files.filter(file => {
      const version = file.split('_')[0];
      return version >= cutoffVersion;
    });
    
    console.log(`Found ${oldFiles.length} migration files older than ${cutoffDate}`);
    console.log(`Found ${newFiles.length} migration files from ${cutoffDate} or newer`);
    
    if (oldFiles.length === 0) {
      console.log('No migrations to consolidate');
      return;
    }
    
    // Generate consolidated file
    let consolidatedContent = `/*
  # Consolidated Migrations (${TODAY})
  
  This file contains all migrations up to but not including ${cutoffDate}.
  It consolidates the following migration files:
  ${oldFiles.map(file => `- ${file}`).join('\n  ')}
*/

-- Start consolidated migration
BEGIN;

-- Ensure schema_version table exists
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- Consolidation logic for each migration file:
-- 1. Check if the migration has been applied
-- 2. If not, apply it
-- 3. Record it in schema_version

`;
    
    // Add content from each file
    for (const file of oldFiles) {
      const version = file.split('_')[0];
      const nameWithoutVersion = file.substring(file.indexOf('_') + 1, file.lastIndexOf('.'));
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      
      // Remove any transaction blocks and schema_version inserts
      // This is a simplified approach; in a real implementation you would want
      // more sophisticated parsing
      let processedContent = content
        .replace(/BEGIN;?\s*|COMMIT;?\s*/g, '')
        .replace(/INSERT INTO schema_version[^;]*;/g, '');
      
      consolidatedContent += `\n-- From ${file}\n`;
      consolidatedContent += `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_version WHERE version = '${version}') THEN
    ${processedContent.split('\n').map(line => `    ${line}`).join('\n')}
    
    -- Record migration in schema_version
    INSERT INTO schema_version (version, description, applied_at)
    VALUES ('${version}', 'From consolidated migration: ${nameWithoutVersion}', NOW());
  END IF;
END $$;

`;
    }
    
    // Close transaction
    consolidatedContent += `COMMIT;

-- Register this consolidated migration
INSERT INTO schema_version (version, description)
VALUES ('${TODAY}000000', 'Consolidated migration')
ON CONFLICT (version) DO NOTHING;
`;
    
    // Write the consolidated file
    const outputPath = path.join(OUTPUT_DIR, CONSOLIDATED_FILENAME);
    await fs.writeFile(outputPath, consolidatedContent);
    
    console.log(`✅ Created consolidated migration file: ${outputPath}`);
    console.log('You may now safely archive the following migration files:');
    for (const file of oldFiles) {
      console.log(`  - ${file}`);
    }
    
  } catch (error) {
    console.error('Error consolidating migrations:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Migration Consolidator ===');
  
  // Default to consolidating migrations older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultCutoffDate = thirtyDaysAgo.toISOString().slice(0, 10);
  
  // Get cutoff date from command line or use default
  const cutoffDate = process.argv[2] || defaultCutoffDate;
  
  console.log(`Consolidating migrations older than ${cutoffDate}`);
  
  await consolidateMigrations(cutoffDate);
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review the consolidated migration file');
  console.log('2. Test it in a development environment');
  console.log('3. Archive old migration files (don\'t delete them yet)');
  console.log('4. Deploy the consolidated file to production');
}

// Run the main function
main();