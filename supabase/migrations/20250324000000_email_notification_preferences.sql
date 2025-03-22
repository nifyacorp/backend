-- Email Notification Preferences Migration
-- This migration adds email notification preferences to the user profile and tracking for email delivery

-- Add email notification preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '08:00:00';

-- Add email tracking fields to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;

-- Create an index to improve performance when querying notifications to send
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(user_id, email_sent, created_at);

-- Add RLS policies for the new columns
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Update the user UPDATE policy to include the new columns
DROP POLICY IF EXISTS "Users can update their own profiles" ON users;
CREATE POLICY "Users can update their own profiles" 
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Update the user SELECT policy
DROP POLICY IF EXISTS "Users can view their own profiles" ON users;
CREATE POLICY "Users can view their own profiles" 
  ON users FOR SELECT
  USING (id = auth.uid());

-- Comment on columns for documentation
COMMENT ON COLUMN users.email_notifications IS 'Flag indicating if the user wants to receive email notifications';
COMMENT ON COLUMN users.notification_email IS 'Email address to send notifications to (if different from account email)';
COMMENT ON COLUMN users.digest_time IS 'Time of day to receive daily notification digests';
COMMENT ON COLUMN notifications.email_sent IS 'Flag indicating if the notification has been sent via email';
COMMENT ON COLUMN notifications.email_sent_at IS 'Timestamp when the notification was sent via email';