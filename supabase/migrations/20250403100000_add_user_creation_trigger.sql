-- Add user creation trigger
-- This migration creates a database trigger that automatically creates a user record
-- if it doesn't exist when inserting a new subscription

-- Create or replace the function to create users if they don't exist
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in the users table
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    -- Insert a new user record with default values
    INSERT INTO users (
      id,
      email,
      name,
      preferences,
      notification_settings
    ) VALUES (
      NEW.user_id, 
      'auto_created@example.com', 
      'Auto-created User', 
      '{}'::jsonb, 
      jsonb_build_object(
        'emailNotifications', true,
        'emailFrequency', 'immediate',
        'instantNotifications', true,
        'notificationEmail', 'auto_created@example.com'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_user_exists_trigger ON subscriptions;

-- Create the trigger
CREATE TRIGGER ensure_user_exists_trigger
BEFORE INSERT ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION create_user_if_not_exists();

-- Add the same trigger for notifications table
DROP TRIGGER IF EXISTS ensure_user_exists_notification_trigger ON notifications;

CREATE TRIGGER ensure_user_exists_notification_trigger
BEFORE INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION create_user_if_not_exists();