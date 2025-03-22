/*
  # Consolidated Database Schema (March 2025)
  
  This file consolidates all previous migrations into a single file for easier maintenance.
  It incorporates:
  - Initial schema setup (20250130114438_late_beacon.sql)
  - Template field additions (20250130154752_pale_gate.sql)
  - Template schema updates (20250130170506_raspy_gate.sql)
  - Notification email tracking (20250225000001_notification_email_sent.sql)
  
  ## Tables Overview
  1. users - Core user accounts with preferences
  2. subscription_types - System and custom subscription categories
  3. subscriptions - User subscriptions with prompts and settings
  4. notifications - Messages generated for users based on subscriptions
  5. activity_logs - Audit trail of user actions
  6. subscription_templates - Reusable subscription configurations
  7. feedback - User feedback on received notifications
  8. subscription_processing - Background processing status tracking
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Custom role-based policies for access control
  - User-scoped data access via current_user_id() function
*/

-- Create application roles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service;
  END IF;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  preferences jsonb DEFAULT '{}',
  notification_settings jsonb DEFAULT '{"emailNotifications": true, "frequency": "immediate"}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subscription types table
CREATE TABLE IF NOT EXISTS subscription_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  description text,
  icon varchar(50),
  logo varchar(255),
  is_system boolean DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  type_id uuid REFERENCES subscription_types(id) NOT NULL,
  name text NOT NULL,
  description text,
  logo varchar(255),
  prompts text[] NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('immediate', 'daily')),
  active boolean DEFAULT true NOT NULL,
  settings jsonb DEFAULT '{}',
  last_check_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT prompts_length_check CHECK (array_length(prompts, 1) <= 3)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_url text,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  read_at timestamptz,
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Subscription templates table
CREATE TABLE IF NOT EXISTS subscription_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  description text,
  prompts text[],
  default_settings jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  is_public boolean DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily',
  icon varchar(50),
  logo varchar(255),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  notification_id uuid REFERENCES notifications(id),
  subscription_id uuid REFERENCES subscriptions(id),
  type text NOT NULL CHECK (type IN ('relevant', 'irrelevant', 'spam')),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Subscription processing table
CREATE TABLE IF NOT EXISTS subscription_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_id ON subscriptions(type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id ON notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_processing_next_run ON subscription_processing(next_run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription ON subscription_processing(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(email_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent_created ON notifications(email_sent, created_at);

-- Insert default subscription types if they don't exist
INSERT INTO subscription_types (name, description, icon, is_system, logo) 
VALUES 
  ('BOE', 'Alertas del Boletín Oficial del Estado', 'FileText', true, 'https://www.boe.es/favicon.ico'),
  ('Inmobiliaria', 'Seguimiento de ofertas inmobiliarias', 'Building2', true, 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_processing ENABLE ROW LEVEL SECURITY;

-- Create function to get current user ID (used by RLS policies)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid;
$$;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at'
  ) THEN
    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'subscription_processing_updated_at'
  ) THEN
    CREATE TRIGGER subscription_processing_updated_at
      BEFORE UPDATE ON subscription_processing
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Create RLS Policies

-- Users table policies
CREATE POLICY IF NOT EXISTS users_select ON users
  FOR SELECT TO app_user
  USING (id = current_user_id());

CREATE POLICY IF NOT EXISTS users_update ON users
  FOR UPDATE TO app_user
  USING (id = current_user_id());

-- Subscription types policies
CREATE POLICY IF NOT EXISTS subscription_types_select ON subscription_types
  FOR SELECT TO app_user
  USING (is_system OR created_by = current_user_id());

CREATE POLICY IF NOT EXISTS subscription_types_insert ON subscription_types
  FOR INSERT TO app_user
  WITH CHECK (NOT is_system AND created_by = current_user_id());

CREATE POLICY IF NOT EXISTS subscription_types_update ON subscription_types
  FOR UPDATE TO app_user
  USING (NOT is_system AND created_by = current_user_id());

-- Subscriptions policies
CREATE POLICY IF NOT EXISTS subscriptions_select ON subscriptions
  FOR SELECT TO app_user
  USING (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS subscriptions_insert ON subscriptions
  FOR INSERT TO app_user
  WITH CHECK (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS subscriptions_update ON subscriptions
  FOR UPDATE TO app_user
  USING (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS subscriptions_delete ON subscriptions
  FOR DELETE TO app_user
  USING (user_id = current_user_id());

-- Notifications policies
CREATE POLICY IF NOT EXISTS notifications_select ON notifications
  FOR SELECT TO app_user
  USING (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS notifications_update ON notifications
  FOR UPDATE TO app_user
  USING (user_id = current_user_id());

-- Activity logs policies
CREATE POLICY IF NOT EXISTS activity_logs_select ON activity_logs
  FOR SELECT TO app_user
  USING (user_id = current_user_id());

-- Templates policies
CREATE POLICY IF NOT EXISTS templates_select ON subscription_templates
  FOR SELECT TO app_user
  USING (is_public OR created_by = current_user_id());

-- Feedback policies
CREATE POLICY IF NOT EXISTS feedback_all ON feedback
  FOR ALL TO app_user
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Service role policies (full access for background jobs)
CREATE POLICY IF NOT EXISTS service_full_access ON subscription_processing
  FOR ALL TO app_service
  USING (true)
  WITH CHECK (true);