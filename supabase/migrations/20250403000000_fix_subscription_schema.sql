/*
  # Fix subscription schema issues (April 3, 2025)
  
  This migration addresses the database schema mismatch error related to the 
  "logo" column in the subscriptions table. It adds the column if it doesn't exist
  and does some schema cleanup to match the code expectations.
*/

-- Add logo column to subscriptions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'logo'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN logo VARCHAR(255);
  END IF;
END $$;

-- Check for and fix other column type mismatches
DO $$
BEGIN
  -- Check if prompts is array type or jsonb
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'prompts'
    AND data_type = 'ARRAY'
  ) THEN
    -- Convert array to jsonb if needed
    ALTER TABLE subscriptions 
    ALTER COLUMN prompts TYPE jsonb USING array_to_json(prompts)::jsonb;
  END IF;
  
  -- Check if type_id is VARCHAR or UUID
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'type_id'
    AND udt_name = 'uuid'
  ) THEN
    -- This is more complex - we need to convert UUIDs to string IDs
    -- Create a temporary column
    ALTER TABLE subscriptions ADD COLUMN temp_type_id VARCHAR(255);
    
    -- Copy the UUID values as strings
    UPDATE subscriptions SET temp_type_id = type_id::text;
    
    -- Drop the foreign key constraint
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_type_id_fkey;
    
    -- Drop the old column
    ALTER TABLE subscriptions DROP COLUMN type_id;
    
    -- Rename the new column
    ALTER TABLE subscriptions RENAME COLUMN temp_type_id TO type_id;
    
    -- Add the foreign key constraint back
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_type_id_fkey 
      FOREIGN KEY (type_id) REFERENCES subscription_types(id);
  END IF;
END $$;

-- Register this migration version if schema_version table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schema_version'
  ) THEN
    INSERT INTO schema_version (version, description)
    VALUES ('20250403000000', 'Fix subscription schema issues')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;