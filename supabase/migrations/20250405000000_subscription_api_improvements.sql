-- Migration to improve the subscription API performance
-- Adds indexes for better query performance with filters

-- Add text search index on subscription name and description
CREATE INDEX IF NOT EXISTS idx_subscriptions_name_trgm ON subscriptions USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subscriptions_description_trgm ON subscriptions USING gin (description gin_trgm_ops);

-- Add extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add index on frequency for filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_frequency ON subscriptions (frequency);

-- Add index on active status for filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions (active);

-- Add index on created_at for date range filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions (created_at);

-- Add composite index on user_id and type_id for common filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_type ON subscriptions (user_id, type_id);

-- Add function to search in JSON arrays (for prompts search)
CREATE OR REPLACE FUNCTION search_json_array(arr jsonb, search_term text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM jsonb_array_elements_text(arr) AS elem 
    WHERE elem ILIKE ('%' || search_term || '%')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if statistics tables exist, create if not
DO $$
BEGIN
  -- No need to create subscription_stats table anymore
  -- Add any other necessary migrations here
END $$;

-- Create function to update subscription stats
CREATE OR REPLACE FUNCTION update_subscription_stats()
RETURNS TRIGGER AS $$
DECLARE
  stats_record RECORD;
  user_total INTEGER;
  user_active INTEGER;
  user_inactive INTEGER;
  sources JSONB;
  frequencies JSONB;
BEGIN
  -- Get current counts
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE active = TRUE) as active,
    COUNT(*) FILTER (WHERE active = FALSE) as inactive
  INTO 
    user_total, user_active, user_inactive
  FROM 
    subscriptions
  WHERE 
    user_id = COALESCE(NEW.user_id, OLD.user_id);

  -- Get counts by source (type)
  WITH source_counts AS (
    SELECT 
      COALESCE(t.name, 'Unknown') as source,
      COUNT(*) as count
    FROM 
      subscriptions s
    LEFT JOIN 
      subscription_types t ON s.type_id = t.id
    WHERE 
      s.user_id = COALESCE(NEW.user_id, OLD.user_id)
    GROUP BY 
      COALESCE(t.name, 'Unknown')
  )
  SELECT 
    jsonb_object_agg(source, count) 
  INTO 
    sources
  FROM 
    source_counts;

  -- Get counts by frequency
  WITH frequency_counts AS (
    SELECT 
      frequency,
      COUNT(*) as count
    FROM 
      subscriptions
    WHERE 
      user_id = COALESCE(NEW.user_id, OLD.user_id)
    GROUP BY 
      frequency
  )
  SELECT 
    jsonb_object_agg(frequency, count) 
  INTO 
    frequencies
  FROM 
    frequency_counts;

  -- Insert or update stats record
  INSERT INTO subscription_stats (
    user_id, total, active, inactive, by_source, by_frequency, updated_at
  ) 
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    user_total,
    user_active,
    user_inactive,
    COALESCE(sources, '{}'::jsonb),
    COALESCE(frequencies, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    total = EXCLUDED.total,
    active = EXCLUDED.active,
    inactive = EXCLUDED.inactive,
    by_source = EXCLUDED.by_source,
    by_frequency = EXCLUDED.by_frequency,
    updated_at = EXCLUDED.updated_at;
    
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update stats on subscription changes
DROP TRIGGER IF EXISTS update_stats_after_subscription_change ON subscriptions;
CREATE TRIGGER update_stats_after_subscription_change
AFTER INSERT OR UPDATE OR DELETE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_subscription_stats();