/*
  # Consolidated Schema Reset (April 2, 2025)
  
  This migration consolidates all previous migrations into a single schema definition.
  It should only be used for new installations or when a complete reset is needed.
  
  WARNING: Running this on an existing database will DROP ALL TABLES and DATA!
  Make sure to have a backup before proceeding in a production environment.
*/

-- Only proceed if this is an empty database or explicit reset is requested
DO $$
BEGIN
  -- Check if we already have schema_version table and this version is applied
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schema_version'
  ) AND EXISTS (
    SELECT 1 FROM schema_version WHERE version = '20250402000000'
  ) THEN
    RAISE NOTICE 'Migration 20250402000000 already applied, skipping';
    RETURN;
  END IF;
  
  -- Check if we're running in reset mode
  -- This requires setting a specific GUC parameter before running:
  -- SET LOCAL app.allow_schema_reset = 'true';
  IF NOT current_setting('app.allow_schema_reset', TRUE) = 'true' THEN
    -- Check if database has existing tables
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('schema_version')
    ) THEN
      RAISE EXCEPTION 'Cannot apply consolidated schema to a database with existing tables. To force reset, set app.allow_schema_reset GUC parameter.';
    END IF;
  END IF;
  
  -- If we get here, proceed with full reset
  RAISE NOTICE 'Performing full schema reset...';
END $$;

-- Drop and recreate the public schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Include the consolidated schema definition
-- (This is the full schema definition from consolidated_schema.sql)

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- Schema Version Tracking
--
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

--
-- Schema Version Management Functions
--
CREATE OR REPLACE FUNCTION check_schema_version(required_version VARCHAR) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_version 
    WHERE version = required_version
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION register_schema_version(version_id VARCHAR, version_description TEXT) 
RETURNS VOID AS $$
BEGIN
  INSERT INTO schema_version (version, description)
  VALUES (version_id, version_description)
  ON CONFLICT (version) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

--
-- Users Table
--
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE users IS 'User accounts for the application';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'User email address, used for login';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata in JSON format';

--
-- Subscription Types Table
--
CREATE TABLE IF NOT EXISTS subscription_types (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE subscription_types IS 'Types of subscriptions available';
COMMENT ON COLUMN subscription_types.id IS 'Unique identifier for the subscription type';
COMMENT ON COLUMN subscription_types.name IS 'System name for the subscription type';
COMMENT ON COLUMN subscription_types.display_name IS 'Human-readable name for display';
COMMENT ON COLUMN subscription_types.icon IS 'Icon name for UI display';

--
-- Subscriptions Table
--
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id VARCHAR(255) NOT NULL REFERENCES subscription_types(id),
  prompts JSONB DEFAULT '[]'::jsonb,
  frequency VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE subscriptions IS 'User subscriptions for different data sources';
COMMENT ON COLUMN subscriptions.id IS 'Unique identifier for the subscription';
COMMENT ON COLUMN subscriptions.user_id IS 'User who owns this subscription';
COMMENT ON COLUMN subscriptions.type_id IS 'Type of subscription (BOE, DOGA, etc)';
COMMENT ON COLUMN subscriptions.prompts IS 'Search terms or prompts for this subscription';
COMMENT ON COLUMN subscriptions.frequency IS 'How often the subscription should be processed';
COMMENT ON COLUMN subscriptions.active IS 'Whether the subscription is currently active';

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_id ON subscriptions(type_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);

--
-- Subscription Processing Table
--
CREATE TABLE IF NOT EXISTS subscription_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subscription_processing IS 'Tracks processing status for subscriptions';
COMMENT ON COLUMN subscription_processing.subscription_id IS 'The subscription being processed';
COMMENT ON COLUMN subscription_processing.status IS 'Current processing status (pending, processing, completed, failed)';
COMMENT ON COLUMN subscription_processing.result IS 'Results of the processing job';

-- Indexes for subscription_processing
CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id ON subscription_processing(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_processing_status ON subscription_processing(status);

--
-- Notifications Table
--
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  entity_type VARCHAR(255) DEFAULT 'notification:generic',
  source VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON COLUMN notifications.user_id IS 'User who should receive this notification';
COMMENT ON COLUMN notifications.title IS 'Notification title';
COMMENT ON COLUMN notifications.content IS 'Notification content text';
COMMENT ON COLUMN notifications.read IS 'Whether the user has read this notification';
COMMENT ON COLUMN notifications.entity_type IS 'Type of entity this notification refers to (format: domain:type)';
COMMENT ON COLUMN notifications.source IS 'Source system that generated this notification';
COMMENT ON COLUMN notifications.data IS 'Structured data related to this notification';
COMMENT ON COLUMN notifications.email_sent IS 'Whether an email was sent for this notification';

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_type ON notifications(entity_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

--
-- Email Notification Preferences Table
--
CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_type VARCHAR(255) REFERENCES subscription_types(id),
  frequency VARCHAR(50) DEFAULT 'immediate',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, subscription_type)
);

COMMENT ON TABLE user_email_preferences IS 'User preferences for email notifications';
COMMENT ON COLUMN user_email_preferences.user_id IS 'User these preferences belong to';
COMMENT ON COLUMN user_email_preferences.subscription_type IS 'Type of subscription these preferences apply to';
COMMENT ON COLUMN user_email_preferences.frequency IS 'How often to send email notifications (immediate, daily, etc)';
COMMENT ON COLUMN user_email_preferences.enabled IS 'Whether email notifications are enabled for this type';

-- Index for user_email_preferences
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_user_id ON user_email_preferences(user_id);

--
-- Row Level Security (RLS) Policies
--

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS application context
CREATE OR REPLACE FUNCTION set_app_user() RETURNS VOID AS $$
BEGIN
  -- Try to get the user_id from the app context
  PERFORM set_config('app.current_user_id', current_setting('app.current_user_id', TRUE), TRUE);
EXCEPTION
  WHEN OTHERS THEN
    -- Default to no user if not set
    PERFORM set_config('app.current_user_id', '', TRUE);
END;
$$ LANGUAGE plpgsql;

-- Create policies for users table
CREATE POLICY users_self_access ON users
  FOR ALL
  USING (id::text = current_setting('app.current_user_id', TRUE));

-- Create policies for subscriptions table
CREATE POLICY subscriptions_user_access ON subscriptions
  FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', TRUE));

-- Create policies for subscription_processing table
CREATE POLICY subscription_processing_user_access ON subscription_processing
  FOR ALL
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions 
      WHERE user_id::text = current_setting('app.current_user_id', TRUE)
    )
  );

-- Create policies for notifications table
CREATE POLICY notifications_user_access ON notifications
  FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', TRUE));

-- Create policies for user_email_preferences table
CREATE POLICY user_email_preferences_user_access ON user_email_preferences
  FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', TRUE));

-- Admin bypass policies
CREATE POLICY admin_all_access ON users
  FOR ALL
  USING (
    current_setting('app.current_user_id', TRUE) IN (
      SELECT id::text FROM users WHERE role = 'admin'
    )
  );

CREATE POLICY admin_all_access ON subscriptions
  FOR ALL
  USING (
    current_setting('app.current_user_id', TRUE) IN (
      SELECT id::text FROM users WHERE role = 'admin'
    )
  );

CREATE POLICY admin_all_access ON subscription_processing
  FOR ALL
  USING (
    current_setting('app.current_user_id', TRUE) IN (
      SELECT id::text FROM users WHERE role = 'admin'
    )
  );

CREATE POLICY admin_all_access ON notifications
  FOR ALL
  USING (
    current_setting('app.current_user_id', TRUE) IN (
      SELECT id::text FROM users WHERE role = 'admin'
    )
  );

CREATE POLICY admin_all_access ON user_email_preferences
  FOR ALL
  USING (
    current_setting('app.current_user_id', TRUE) IN (
      SELECT id::text FROM users WHERE role = 'admin'
    )
  );

--
-- Initial Default Data
--

-- Insert default subscription types if they don't exist
INSERT INTO subscription_types (id, name, display_name, icon)
VALUES 
  ('boe', 'boe', 'BOE', 'FileText'),
  ('doga', 'doga', 'DOGA', 'FileText'),
  ('real-estate', 'real-estate', 'Real Estate', 'Home')
ON CONFLICT (id) DO NOTHING;

-- Register this migration
INSERT INTO schema_version (version, description)
VALUES ('20250402000000', 'Consolidated schema reset');