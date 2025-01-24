/*
  # Initial Database Schema

  1. Tables
    - users: Extended user profiles
    - subscriptions: User subscription management
    - notifications: User notification tracking
    - activity_logs: User activity tracking
    - subscription_templates: Pre-configured templates
    - feedback: User feedback system

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  preferences jsonb DEFAULT '{}',
  notification_settings jsonb DEFAULT '{"email": true, "frequency": "immediate"}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users NOT NULL,
  type text NOT NULL CHECK (type IN ('boe', 'real-estate', 'custom')),
  name text NOT NULL,
  description text,
  prompts text[] NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('immediate', 'daily')),
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  settings jsonb DEFAULT '{}',
  last_check_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users NOT NULL,
  subscription_id uuid REFERENCES subscriptions NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_url text,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users NOT NULL,
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
  default_prompts text[],
  default_settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users NOT NULL,
  notification_id uuid REFERENCES notifications,
  subscription_id uuid REFERENCES subscriptions,
  type text NOT NULL CHECK (type IN ('relevant', 'irrelevant', 'spam')),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read subscription templates"
  ON subscription_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own feedback"
  ON feedback FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);