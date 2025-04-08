-- Migration: Add parser_url to subscription_types
-- This migration adds new columns to the subscription_types table for dynamic parser resolution

-- Create a safer migration that checks if columns exist first
DO $$
BEGIN
    -- Add parser_url if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscription_types' AND column_name='parser_url') THEN
        ALTER TABLE subscription_types 
        ADD COLUMN parser_url VARCHAR(255);
        
        RAISE NOTICE 'Added parser_url column to subscription_types table';
    ELSE
        RAISE NOTICE 'parser_url column already exists in subscription_types table';
    END IF;
    
    -- Add description if it doesn't exist in some versions (some migrations already have it)
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscription_types' AND column_name='description') THEN
        ALTER TABLE subscription_types 
        ADD COLUMN description TEXT;
        
        RAISE NOTICE 'Added description column to subscription_types table';
    ELSE
        RAISE NOTICE 'description column already exists in subscription_types table';
    END IF;
    
    -- Add logo_url if it doesn't exist in some versions
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscription_types' AND column_name='logo_url') THEN
        ALTER TABLE subscription_types 
        ADD COLUMN logo_url VARCHAR(255);
        
        RAISE NOTICE 'Added logo_url column to subscription_types table';
    ELSE
        RAISE NOTICE 'logo_url column already exists in subscription_types table';
    END IF;
END
$$;

-- Insert or update default subscription types with parser URLs
UPDATE subscription_types 
SET parser_url = 'https://boe-parser-415554190254.us-central1.run.app',
    description = 'Processes Spanish official bulletins for relevant information'
WHERE name = 'boe' OR id = 'boe';

UPDATE subscription_types 
SET parser_url = 'https://doga-parser-415554190254.us-central1.run.app',
    description = 'Processes Galician official bulletins for relevant information'
WHERE name = 'doga' OR id = 'doga';

-- If there are no matches, perform inserts for the base types
INSERT INTO subscription_types (id, name, display_name, parser_url, description, icon, is_system)
SELECT 'boe', 'boe', 'BOE (Spanish Official Bulletin)', 
       'https://boe-parser-415554190254.us-central1.run.app',
       'Processes Spanish official bulletins for relevant information',
       'FileText', true
WHERE NOT EXISTS (SELECT 1 FROM subscription_types WHERE name = 'boe' OR id = 'boe');

INSERT INTO subscription_types (id, name, display_name, parser_url, description, icon, is_system)
SELECT 'doga', 'doga', 'DOGA (Galician Official Bulletin)',
       'https://doga-parser-415554190254.us-central1.run.app',
       'Processes Galician official bulletins for relevant information',
       'FileText', true
WHERE NOT EXISTS (SELECT 1 FROM subscription_types WHERE name = 'doga' OR id = 'doga'); 