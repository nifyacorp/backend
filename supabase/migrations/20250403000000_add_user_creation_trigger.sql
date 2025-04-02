-- Migration file to add a database trigger that ensures users exist before creating subscriptions
-- This helps prevent foreign key constraint errors when creating subscriptions

-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in the users table
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id) THEN
    -- Insert a new user record with default values
    INSERT INTO public.users (
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
    
    RAISE NOTICE 'Auto-created user with ID: %', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists to avoid errors
DROP TRIGGER IF EXISTS ensure_user_exists_trigger ON public.subscriptions;

-- Create the trigger to run before INSERT on subscriptions table
CREATE TRIGGER ensure_user_exists_trigger
BEFORE INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION create_user_if_not_exists();

-- Add a comment to the trigger for documentation
COMMENT ON TRIGGER ensure_user_exists_trigger ON public.subscriptions IS 
'Ensures that a user record exists before creating a subscription, preventing foreign key constraint errors';