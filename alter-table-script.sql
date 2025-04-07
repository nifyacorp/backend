-- Check if subscription_processing table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_processing') THEN
        -- Create the subscription_processing table
        CREATE TABLE IF NOT EXISTS subscription_processing (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subscription_id UUID NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            result JSONB DEFAULT '{}'::jsonb,
            error_message TEXT,
            user_id UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_subscription_processing_subscription_id 
            ON subscription_processing(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_subscription_processing_status 
            ON subscription_processing(status);
    ELSE
        -- Check if user_id column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'subscription_processing' 
            AND column_name = 'user_id'
        ) THEN
            -- Add user_id column if it doesn't exist
            ALTER TABLE subscription_processing 
            ADD COLUMN user_id UUID;
        END IF;
    END IF;
END $$; 