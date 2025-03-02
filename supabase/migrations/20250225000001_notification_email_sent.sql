/*
  # Add Email Sent Tracking to Notifications

  1. Changes to Notifications Table
    - Add email_sent boolean column
    - Add email_sent_at timestamp column
    - Add index for faster queries

  2. Default Values
    - Set existing notifications to email_sent = true
*/

-- Add email_sent column if it doesn't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- Add email_sent_at column if it doesn't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Set existing notifications to email_sent = true
UPDATE notifications SET email_sent = TRUE WHERE email_sent IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(email_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent_created ON notifications(email_sent, created_at); 