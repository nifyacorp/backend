/*
  # RLS Policy Fix (March 24, 2025)
  
  This migration specifically targets and fixes the syntax error in RLS policies.
  The issue was with the boolean expression syntax using 'NOT is_system' which is invalid in PostgreSQL.
  This migration drops and recreates the problematic policies with the correct syntax 'is_system = false'.
*/

-- Drop problematic policies if they exist
DROP POLICY IF EXISTS subscription_types_insert ON subscription_types;
DROP POLICY IF EXISTS subscription_types_update ON subscription_types;

-- Recreate the policies with correct syntax
CREATE POLICY subscription_types_insert ON subscription_types
  FOR INSERT TO app_user
  WITH CHECK (is_system = false AND created_by = current_user_id());

CREATE POLICY subscription_types_update ON subscription_types
  FOR UPDATE TO app_user
  USING (is_system = false AND created_by = current_user_id());

-- Apply the same fix to any IF NOT EXISTS policies
DROP POLICY IF EXISTS subscription_types_insert_2 ON subscription_types;
DROP POLICY IF EXISTS subscription_types_update_2 ON subscription_types;

-- Recreate the policies with IF NOT EXISTS
CREATE POLICY IF NOT EXISTS subscription_types_insert ON subscription_types
  FOR INSERT TO app_user
  WITH CHECK (is_system = false AND created_by = current_user_id());

CREATE POLICY IF NOT EXISTS subscription_types_update ON subscription_types
  FOR UPDATE TO app_user
  USING (is_system = false AND created_by = current_user_id());