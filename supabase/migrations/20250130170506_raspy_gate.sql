/*
  # Update template schema

  1. Changes
    - Rename columns in subscription_templates table to match our new structure
    - Add new columns for metadata and icons
    - Update existing data to match new structure

  2. Security
    - Maintain existing RLS policies
*/

-- Rename and modify columns in subscription_templates
ALTER TABLE subscription_templates
  -- Rename columns to match new structure
  RENAME COLUMN default_prompts TO prompts;

-- Add new columns
ALTER TABLE subscription_templates
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS icon varchar(50),
  ADD COLUMN IF NOT EXISTS logo varchar(255),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Update system templates with proper types
UPDATE subscription_templates 
SET 
  type = 'boe',
  icon = 'FileText',
  logo = 'https://www.boe.es/favicon.ico',
  metadata = jsonb_build_object(
    'category', 'government',
    'source', 'boe'
  )
WHERE type = 'custom' AND name ILIKE '%BOE%';

UPDATE subscription_templates 
SET 
  type = 'real-estate',
  icon = 'Building2',
  logo = 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png',
  metadata = jsonb_build_object(
    'category', 'real-estate',
    'source', 'property-listings'
  )
WHERE type = 'custom' AND (
  name ILIKE '%vivienda%' OR 
  name ILIKE '%alquiler%' OR 
  name ILIKE '%inmobiliaria%'
);