/*
  # Migration System Fix (April 2, 2025)
  
  This migration ensures the schema_version table is properly established
  and fixes any duplicate entry issues.
*/

-- Create schema_version table if it doesn't exist (safe idempotent operation)
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- Update the migration record for the schema_version table creation
-- This uses ON CONFLICT DO UPDATE to safely modify existing records
INSERT INTO schema_version (version, description, applied_at)
VALUES ('20250401500000', 'Create schema_version table with migration system improvements', NOW())
ON CONFLICT (version) 
DO UPDATE SET description = 'Create schema_version table with migration system improvements';

-- Update the consolidated schema reset record if it exists
INSERT INTO schema_version (version, description, applied_at)
VALUES ('20250402000000', 'Consolidated schema reset with improvements', NOW())
ON CONFLICT (version) 
DO UPDATE SET description = 'Consolidated schema reset with improvements';

-- Add this migration (20250402000001) to the schema_version table
INSERT INTO schema_version (version, description)
VALUES ('20250402000001', 'Migration system fix') 
ON CONFLICT (version) DO NOTHING;