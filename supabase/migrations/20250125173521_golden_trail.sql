/*
  # Add subscription types support
  
  1. New Tables
    - `subscription_types`
      - `id` (uuid, primary key)
      - `name` (varchar)
      - `description` (text)
      - `icon` (varchar)
      - `is_system` (boolean)
      - `created_by` (uuid, references users)
      - Timestamps

  2. Changes
    - Modify `subscriptions` table to use type_id
    - Add check constraint for prompts array length
    - Add default system types

  3. Security
    - Enable RLS on subscription_types
    - Add policies for viewing and managing types
*/

-- Create subscription types table
CREATE TABLE IF NOT EXISTS subscription_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add type_id to subscriptions and modify constraints
ALTER TABLE subscriptions 
  ADD COLUMN type_id UUID REFERENCES subscription_types(id),
  ADD CONSTRAINT prompts_length_check CHECK (array_length(prompts, 1) <= 3),
  ALTER COLUMN status TYPE boolean USING CASE WHEN status = 'active' THEN true ELSE false END,
  ALTER COLUMN status SET DEFAULT true,
  ALTER COLUMN status SET NOT NULL,
  RENAME COLUMN status TO active;

-- Insert default system types
INSERT INTO subscription_types (name, description, icon, is_system) VALUES
  ('BOE', 'Alertas del Boletín Oficial del Estado', 'FileText', true),
  ('Inmobiliaria', 'Seguimiento de ofertas inmobiliarias', 'Building2', true);

-- Enable RLS
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription types
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