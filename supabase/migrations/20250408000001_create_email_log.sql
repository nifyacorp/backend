-- Migration to create email_log table for tracking email events
-- This provides a fallback mechanism when PubSub is unavailable

-- First check if the table exists
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'test', 'notification', 'digest', etc.
  status VARCHAR(50) NOT NULL, -- 'queued', 'sent', 'failed', etc.
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS email_log_user_id_idx ON email_log(user_id);
CREATE INDEX IF NOT EXISTS email_log_email_idx ON email_log(email);
CREATE INDEX IF NOT EXISTS email_log_status_idx ON email_log(status);
CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON email_log(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE email_log IS 'Log of email events, provides fallback when PubSub is unavailable';

-- Add row-level security policies
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own email logs
CREATE POLICY email_log_select_policy ON email_log 
FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own email logs (test emails)
CREATE POLICY email_log_insert_policy ON email_log 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only allow service role to update email logs
CREATE POLICY email_log_update_policy ON email_log 
FOR UPDATE USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

-- Grant access to authenticated users
GRANT SELECT, INSERT ON email_log TO authenticated;

-- Add entry to schema_version table
INSERT INTO schema_version (version, migration_name, description, applied_at, script_name)
VALUES ('20250408000001', 'create_email_log', 'Create email_log table for tracking email events', CURRENT_TIMESTAMP, '20250408000001_create_email_log.sql')
ON CONFLICT (version) DO NOTHING;