/*
  # Add entity_type column to notifications table (April 1, 2025)
  
  This migration adds a dedicated entity_type column to the notifications table
  to improve frontend rendering of notifications. The entity_type field was 
  previously stored in the metadata JSON and needs to be a separate column 
  with a proper format (domain:type).
*/

-- Add entity_type column to notifications table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE notifications 
    ADD COLUMN entity_type text DEFAULT 'notification:generic';
  END IF;
END $$;

-- Create an index on entity_type for performance
CREATE INDEX IF NOT EXISTS idx_notifications_entity_type ON notifications(entity_type);

-- Update existing notifications to populate entity_type from metadata if possible
UPDATE notifications 
SET entity_type = 
  CASE
    -- If metadata has entity_type field, use that
    WHEN metadata ? 'entity_type' AND metadata->>'entity_type' != '' THEN 
      metadata->>'entity_type'
    -- If metadata has document_type field, create a BOE entity type  
    WHEN metadata ? 'document_type' AND metadata->>'document_type' != '' THEN 
      'boe:' || (metadata->>'document_type')
    -- If notification has BOE in title, use boe:document
    WHEN title ILIKE '%BOE%' THEN 
      'boe:document'
    -- Otherwise, use a generic type
    ELSE 
      'notification:generic'
  END
WHERE entity_type IS NULL OR entity_type = '';