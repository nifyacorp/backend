-- Fix subscription schema to ensure logo column exists
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

-- Create function to automatically create user record if it doesn't exist
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in the users table
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    -- Insert a new user record
    INSERT INTO users (id, email, name, preferences, notification_settings)
    VALUES (
      NEW.user_id, 
      'auto_created@example.com', 
      'Auto-created User', 
      '{}'::jsonb, 
      '{"emailNotifications": true, "emailFrequency": "immediate", "instantNotifications": true}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on subscriptions table to ensure user exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_user_exists_trigger'
  ) THEN
    CREATE TRIGGER ensure_user_exists_trigger
    BEFORE INSERT ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION create_user_if_not_exists();
  END IF;
END $$;

-- Note: This script adds:
-- 1. The logo column to subscriptions table if it doesn't exist
-- 2. A trigger function to automatically create user records when subscriptions are created
--    with a user_id that doesn't exist in the users table