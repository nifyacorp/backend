/*
  # Add logo field to subscriptions

  1. Changes
    - Add `logo` column to subscriptions table
    - Add `logo` column to subscription_types table
    - Update existing system types with default logos

  2. Security
    - No changes to RLS policies needed
    - Existing policies will cover the new field
*/

-- Add logo column to subscription_types
ALTER TABLE subscription_types
ADD COLUMN logo VARCHAR(255);

-- Add logo column to subscriptions
ALTER TABLE subscriptions
ADD COLUMN logo VARCHAR(255);

-- Update system types with default logos
UPDATE subscription_types
SET logo = CASE 
  WHEN name = 'BOE' THEN 'https://www.boe.es/favicon.ico'
  WHEN name = 'Inmobiliaria' THEN 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png'
  ELSE logo
END
WHERE is_system = true;