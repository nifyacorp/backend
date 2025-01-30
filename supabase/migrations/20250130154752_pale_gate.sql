/*
  # Add fields to subscription templates

  1. Changes
    - Add new columns to subscription_templates table:
      - icon: For displaying template icon (varchar)
      - logo: For template logo URL (varchar)
      - metadata: For additional template data (jsonb)

  2. Data Updates
    - Update existing built-in templates with icons and logos
    - Add metadata structure for future extensibility

  3. Security
    - Maintain existing RLS policies
    - No changes to security model needed
*/

-- Add new columns to subscription_templates
ALTER TABLE subscription_templates 
  ADD COLUMN IF NOT EXISTS icon varchar(50),
  ADD COLUMN IF NOT EXISTS logo varchar(255),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Update existing built-in templates with icons and logos
UPDATE subscription_templates 
SET 
  icon = 'FileText',
  logo = 'https://www.boe.es/favicon.ico',
  metadata = jsonb_build_object(
    'category', 'government',
    'source', 'boe'
  )
WHERE type = 'boe';

UPDATE subscription_templates 
SET 
  icon = 'Building2',
  logo = 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png',
  metadata = jsonb_build_object(
    'category', 'real-estate',
    'source', 'property-listings'
  )
WHERE type = 'real-estate';

-- Add specific icons for different BOE templates
UPDATE subscription_templates 
SET icon = 'GanttChart'
WHERE name = 'BOE General';

UPDATE subscription_templates 
SET icon = 'Coins'
WHERE name = 'Subvenciones BOE';

UPDATE subscription_templates 
SET icon = 'UserSquare2'
WHERE name = 'Empleo Público BOE';

-- Add specific icons for real estate templates
UPDATE subscription_templates 
SET icon = 'Key'
WHERE name = 'Alquiler de Viviendas';

UPDATE subscription_templates 
SET icon = 'Home'
WHERE name = 'Compra de Viviendas';