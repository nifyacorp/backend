/*
  # Add subscription processing tracking

  1. New Tables
    - `subscription_processing`
      - `id` (uuid, primary key)
      - `subscription_id` (uuid, foreign key to subscriptions)
      - `last_run_at` (timestamptz)
      - `next_run_at` (timestamptz)
      - `status` (text, enum)
      - `error` (text, nullable)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `subscription_processing` table
    - Add policies for authenticated users to manage their own processing records
*/

-- Create subscription processing table
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

-- Create index for efficient querying
CREATE INDEX idx_subscription_processing_next_run 
ON subscription_processing(next_run_at)
WHERE status = 'pending';

CREATE INDEX idx_subscription_processing_subscription 
ON subscription_processing(subscription_id);

-- Enable RLS
ALTER TABLE subscription_processing ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own subscription processing"
  ON subscription_processing
  FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service can manage subscription processing"
  ON subscription_processing
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_processing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_subscription_processing_timestamp
  BEFORE UPDATE ON subscription_processing
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_processing_updated_at();