-- Migration to fix email preferences storage
-- This migration adds the notification_settings column to the users table if it doesn't exist
-- It also migrates existing email preferences from metadata to notification_settings

-- Add notification_settings column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'notification_settings'
    ) THEN
        ALTER TABLE users ADD COLUMN notification_settings JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Migrate existing email preferences from metadata to notification_settings
    UPDATE users
    SET notification_settings = jsonb_build_object(
        'emailNotifications', 
        CASE WHEN metadata->>'emailNotifications' IS NOT NULL 
            THEN (metadata->>'emailNotifications')::boolean 
            ELSE email_notifications END,
            
        'notificationEmail', 
        CASE WHEN metadata->>'notificationEmail' IS NOT NULL 
            THEN metadata->>'notificationEmail' 
            ELSE notification_email END,
            
        'digestTime', 
        CASE WHEN metadata->>'digestTime' IS NOT NULL 
            THEN metadata->>'digestTime' 
            ELSE digest_time END
    )
    WHERE (metadata->>'emailNotifications' IS NOT NULL OR 
           metadata->>'notificationEmail' IS NOT NULL OR 
           metadata->>'digestTime' IS NOT NULL OR
           email_notifications IS NOT NULL OR
           notification_email IS NOT NULL OR
           digest_time IS NOT NULL) AND
          (notification_settings IS NULL OR notification_settings = '{}'::jsonb);
    
    -- Add email_sent and email_sent_at columns to notifications table if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'email_sent'
    ) THEN
        ALTER TABLE notifications ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'email_sent_at'
    ) THEN
        ALTER TABLE notifications ADD COLUMN email_sent_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Ensure the email.test topic exists in the schema_version table
INSERT INTO schema_version (version, migration_name, description, applied_at, script_name)
VALUES ('20250408000000', 'fix_email_preferences', 'Add notification_settings column and fix email preferences', CURRENT_TIMESTAMP, '20250408000000_fix_email_preferences.sql')
ON CONFLICT (version) DO NOTHING;

-- Add a comment explaining the new columns
COMMENT ON COLUMN users.notification_settings IS 'User email notification preferences stored as JSONB';
COMMENT ON COLUMN notifications.email_sent IS 'Whether this notification has been sent via email';
COMMENT ON COLUMN notifications.email_sent_at IS 'Timestamp when the notification was sent via email';