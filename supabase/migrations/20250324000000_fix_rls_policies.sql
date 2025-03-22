/*
  # RLS Policy Fix (March 24, 2025)
  
  This migration specifically targets and fixes the syntax error in RLS policies.
  The issue was with the boolean expression syntax using 'NOT is_system' which is invalid in PostgreSQL.
  
  IMPORTANT: This file MUST apply cleanly on both new and existing databases.
*/

-- Ensure app_user role exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service;
  END IF;
END $$;

-- Make sure the current_user_id function exists
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid;
$$;

-- Drop all problematic policies that might contain NOT is_system
DROP POLICY IF EXISTS subscription_types_insert ON subscription_types;
DROP POLICY IF EXISTS subscription_types_update ON subscription_types;

-- Create new policies with correct syntax (only if the subscription_types table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscription_types') THEN
    -- Check if RLS is enabled on the table
    IF NOT EXISTS (
      SELECT FROM pg_tables 
      WHERE tablename = 'subscription_types' 
      AND rowsecurity = true
    ) THEN
      -- Enable RLS
      EXECUTE 'ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY';
    END IF;

    -- Create policies with the correct syntax
    IF NOT EXISTS (
      SELECT FROM pg_policies 
      WHERE tablename = 'subscription_types' 
      AND policyname = 'subscription_types_insert'
    ) THEN
      EXECUTE '
        CREATE POLICY subscription_types_insert ON subscription_types
        FOR INSERT TO app_user
        WITH CHECK (is_system = false AND created_by = current_user_id())
      ';
    END IF;

    IF NOT EXISTS (
      SELECT FROM pg_policies 
      WHERE tablename = 'subscription_types' 
      AND policyname = 'subscription_types_update'
    ) THEN
      EXECUTE '
        CREATE POLICY subscription_types_update ON subscription_types
        FOR UPDATE TO app_user
        USING (is_system = false AND created_by = current_user_id())
      ';
    END IF;
  END IF;
END $$;