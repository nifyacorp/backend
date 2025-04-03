-- Migration to fix subscription API issues

-- Add display_name column to subscription_types if it doesn't exist
ALTER TABLE subscription_types ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Populate display_name with name values where null
UPDATE subscription_types SET display_name = name WHERE display_name IS NULL;

-- Create subscription_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  display_name VARCHAR(100)
);

-- Create index on name
CREATE INDEX IF NOT EXISTS idx_subscription_types_name ON subscription_types(name);

-- Insert default subscription types if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscription_types LIMIT 1) THEN
    -- Insert BOE type
    INSERT INTO subscription_types (id, name, description, icon, is_system, display_name)
    VALUES (
      'boe', 
      'BOE',
      'Boletín Oficial del Estado',
      'FileText',
      TRUE,
      'BOE'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Insert DOGA type
    INSERT INTO subscription_types (id, name, description, icon, is_system, display_name)
    VALUES (
      'doga',
      'DOGA',
      'Diario Oficial de Galicia',
      'FileText',
      TRUE,
      'DOGA'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Insert Real Estate type
    INSERT INTO subscription_types (id, name, description, icon, is_system, display_name)
    VALUES (
      'real-estate',
      'Inmobiliaria',
      'Búsquedas inmobiliarias',
      'Home',
      TRUE,
      'Inmobiliaria'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;