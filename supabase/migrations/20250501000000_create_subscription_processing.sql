-- Create the subscription_processing table if it doesn't exist
DO $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_processing'
  ) THEN
    RAISE NOTICE 'Creating subscription_processing table...';
    
    -- Create the subscription_processing table
    CREATE TABLE subscription_processing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      result JSONB DEFAULT '{}'::jsonb,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add foreign key if subscriptions table exists
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'subscriptions'
    ) THEN
      ALTER TABLE subscription_processing 
      ADD CONSTRAINT subscription_processing_subscription_id_fkey 
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Added foreign key constraint to subscription_processing table';
    ELSE
      RAISE NOTICE 'Subscriptions table does not exist, skipping foreign key constraint';
    END IF;
    
    -- Create indexes
    CREATE INDEX idx_subscription_processing_subscription_id ON subscription_processing(subscription_id);
    CREATE INDEX idx_subscription_processing_status ON subscription_processing(status);
    
    RAISE NOTICE 'Successfully created subscription_processing table and indexes';
  ELSE
    RAISE NOTICE 'subscription_processing table already exists, skipping creation';
  END IF;
END
$$; 