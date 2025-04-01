/*
  # Create Schema Version Table (April 1, 2025)
  
  This migration creates the schema_version table that's required for tracking
  migration history. It runs before the consolidated schema migration to ensure
  the table exists.
*/

-- Create schema_version table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- Add version tracking functions
CREATE OR REPLACE FUNCTION check_schema_version(required_version VARCHAR) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_version 
    WHERE version = required_version
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION register_schema_version(version_id VARCHAR, version_description TEXT) 
RETURNS VOID AS $$
BEGIN
  INSERT INTO schema_version (version, description)
  VALUES (version_id, version_description)
  ON CONFLICT (version) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Register this migration
INSERT INTO schema_version (version, description)
VALUES ('20250401500000', 'Create schema_version table');