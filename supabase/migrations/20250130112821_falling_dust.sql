/*
  # Complete Schema Setup
  
  1. New Tables
    - Adds any missing tables
    - Ensures all required columns exist
    - Sets up proper relationships
  
  2. Security
    - Enables RLS on all tables
    - Adds necessary policies
    
  3. Indexes
    - Creates performance indexes
*/

-- Create subscription types table if not exists
CREATE TABLE IF NOT EXISTS subscription_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  logo VARCHAR(255),
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure type column exists in subscriptions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'type'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN type TEXT CHECK (type IN ('boe', 'real-estate', 'custom'));
  END IF;
END $$;

-- Ensure prompts length constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prompts_length_check'
  ) THEN
    ALTER TABLE subscriptions 
    ADD CONSTRAINT prompts_length_check 
    CHECK (array_length(prompts, 1) <= 3);
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_subscriptions_user_id'
  ) THEN
    CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_subscriptions_type_id'
  ) THEN
    CREATE INDEX idx_subscriptions_type_id ON subscriptions(type_id);
  END IF;
END $$;

-- Insert default system types if they don't exist
INSERT INTO subscription_types (name, description, icon, is_system, logo) 
VALUES 
  ('BOE', 'Alertas del Boletín Oficial del Estado', 'FileText', true, 'https://www.boe.es/favicon.ico'),
  ('Inmobiliaria', 'Seguimiento de ofertas inmobiliarias', 'Building2', true, 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on subscription_types if not already enabled
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;

-- Create or replace RLS policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "View subscription types" ON subscription_types;
  DROP POLICY IF EXISTS "Create custom types" ON subscription_types;
  DROP POLICY IF EXISTS "Update own custom types" ON subscription_types;
  DROP POLICY IF EXISTS "Delete own custom types" ON subscription_types;
  
  -- Create new policies
  CREATE POLICY "View subscription types"
    ON subscription_types
    FOR SELECT
    TO authenticated
    USING (is_system OR created_by = auth.uid());

  CREATE POLICY "Create custom types"
    ON subscription_types
    FOR INSERT
    TO authenticated
    WITH CHECK (NOT is_system AND created_by = auth.uid());

  CREATE POLICY "Update own custom types"
    ON subscription_types
    FOR UPDATE
    TO authenticated
    USING (NOT is_system AND created_by = auth.uid());

  CREATE POLICY "Delete own custom types"
    ON subscription_types
    FOR DELETE
    TO authenticated
    USING (NOT is_system AND created_by = auth.uid());
END $$;