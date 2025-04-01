/*
  # NIFYA Complete Database Schema (April 1, 2025)
  
  This file contains the complete database schema for NIFYA.
  It replaces all previous migration files with a single, comprehensive schema.
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema_version table for tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- Create utility functions
CREATE OR REPLACE FUNCTION check_schema_version(required_version character varying) RETURNS boolean
  LANGUAGE plpgsql
  AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_version 
    WHERE version = required_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION register_schema_version(version_id character varying, version_description text) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  INSERT INTO schema_version (version, description)
  VALUES (version_id, version_description)
  ON CONFLICT (version) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION set_app_user() RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Try to get the user_id from the app context
  PERFORM set_config('app.current_user_id', current_setting('app.current_user_id', TRUE), TRUE);
EXCEPTION
  WHEN OTHERS THEN
    -- Default to no user if not set
    PERFORM set_config('app.current_user_id', '', TRUE);
END;
$$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  email_verified BOOLEAN DEFAULT false,
  notification_settings JSONB DEFAULT '{
    "emailNotifications": true,
    "notificationEmail": null,
    "emailFrequency": "daily",
    "instantNotifications": false,
    "language": "es"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User email preferences (legacy table, consider removing if using notification_settings in users table)
CREATE TABLE IF NOT EXISTS user_email_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  immediate BOOLEAN DEFAULT true,
  daily BOOLEAN DEFAULT true,
  weekly BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription types
CREATE TABLE IF NOT EXISTS subscription_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  type VARCHAR(50) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription templates
CREATE TABLE IF NOT EXISTS subscription_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  prompts JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true, 
  logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id UUID REFERENCES subscription_types(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompts JSONB DEFAULT '[]'::jsonb,
  frequency VARCHAR(50) DEFAULT 'daily',
  settings JSONB DEFAULT '{}'::jsonb,
  logo TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription processing
CREATE TABLE IF NOT EXISTS subscription_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  error_message TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  source_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  entity_type VARCHAR(255) DEFAULT 'notification:generic',
  source VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_id ON subscriptions(type_id);
CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id ON subscription_processing(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id ON notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(email_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_user_id ON user_email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users
CREATE POLICY users_isolation_policy ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id', true)::uuid);

-- Subscriptions
CREATE POLICY subscriptions_isolation_policy ON subscriptions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Subscription processing
CREATE POLICY subscription_processing_isolation_policy ON subscription_processing
  FOR ALL
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Notifications
CREATE POLICY notifications_isolation_policy ON notifications
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- User email preferences
CREATE POLICY user_email_preferences_isolation_policy ON user_email_preferences
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Insert the current schema version
INSERT INTO schema_version (version, description)
VALUES ('20250401000000', 'Complete schema reset')
ON CONFLICT (version) DO NOTHING;