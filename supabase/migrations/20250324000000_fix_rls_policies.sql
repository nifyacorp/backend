/*
  # RLS Policy Fix (March 24, 2025)
  
  This migration specifically targets and fixes the syntax error in RLS policies.
  The issue was with the boolean expression syntax using 'NOT is_system' which is invalid in PostgreSQL.
  
  IMPORTANT: This file MUST apply cleanly on both new and existing databases.
*/

-- Drop all problematic policies that might contain NOT is_system
DROP POLICY IF EXISTS subscription_types_insert ON subscription_types;
DROP POLICY IF EXISTS subscription_types_update ON subscription_types;

-- Create new policies with correct syntax
CREATE POLICY subscription_types_insert ON subscription_types
  FOR INSERT TO app_user
  WITH CHECK (is_system = false AND created_by = current_user_id());

CREATE POLICY subscription_types_update ON subscription_types
  FOR UPDATE TO app_user
  USING (is_system = false AND created_by = current_user_id());

-- Make sure the current_user_id function exists
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid;
$$;