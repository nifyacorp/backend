-- Add subscription sharing functionality
-- Create subscription_shares table if it doesn't exist

-- First check if the table already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_shares'
    ) THEN
        -- Create the subscription shares table
        CREATE TABLE subscription_shares (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            shared_with UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(subscription_id, shared_by, shared_with)
        );

        -- Create index for performance on queries
        CREATE INDEX idx_subscription_shares_subscription_id ON subscription_shares(subscription_id);
        CREATE INDEX idx_subscription_shares_shared_by ON subscription_shares(shared_by);
        CREATE INDEX idx_subscription_shares_shared_with ON subscription_shares(shared_with);

        -- Add RLS policies for subscription_shares
        ALTER TABLE subscription_shares ENABLE ROW LEVEL SECURITY;

        -- Only allow users to see shares they are involved with
        CREATE POLICY subscription_shares_select_policy ON subscription_shares
            FOR SELECT
            USING (
                auth.uid() = shared_by OR 
                auth.uid() = shared_with
            );

        -- Only allow users to insert shares for subscriptions they own
        CREATE POLICY subscription_shares_insert_policy ON subscription_shares
            FOR INSERT
            WITH CHECK (
                auth.uid() = shared_by AND 
                EXISTS (
                    SELECT 1 FROM subscriptions 
                    WHERE subscriptions.id = subscription_id 
                    AND subscriptions.user_id = auth.uid()
                )
            );

        -- Only allow users to update shares they created
        CREATE POLICY subscription_shares_update_policy ON subscription_shares
            FOR UPDATE
            USING (auth.uid() = shared_by)
            WITH CHECK (auth.uid() = shared_by);

        -- Only allow users to delete shares they created
        CREATE POLICY subscription_shares_delete_policy ON subscription_shares
            FOR DELETE
            USING (auth.uid() = shared_by);
    END IF;
END
$$;