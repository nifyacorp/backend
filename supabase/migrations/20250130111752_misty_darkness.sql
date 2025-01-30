/*
  # Add type_id to subscriptions table

  1. Changes
    - Add type_id column to subscriptions table
    - Add foreign key constraint to subscription_types
    - Add index for better query performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add type_id column with foreign key constraint
ALTER TABLE subscriptions 
ADD COLUMN type_id UUID REFERENCES subscription_types(id);

-- Add index for better join performance
CREATE INDEX idx_subscriptions_type_id ON subscriptions(type_id);