-- Fix the subscription types and templates tables
-- This migration ensures the required tables exist with the correct structure

-- Create the subscription_types table if it doesn't exist or recreate it with the correct structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_types') THEN
        -- Table exists, let's check if it has the correct structure
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'subscription_types' AND column_name = 'name') THEN
            -- The table exists but doesn't have the expected structure
            -- Drop and recreate it
            DROP TABLE subscription_types CASCADE;
            
            -- Create the table with the correct structure
            CREATE TABLE subscription_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                icon VARCHAR(50),
                is_system BOOLEAN DEFAULT false,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        END IF;
    ELSE
        -- Table doesn't exist, create it
        CREATE TABLE subscription_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            icon VARCHAR(50),
            is_system BOOLEAN DEFAULT false,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
    
    -- Create indexes if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscription_types_name') THEN
        CREATE INDEX idx_subscription_types_name ON subscription_types(name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscription_types_is_system') THEN
        CREATE INDEX idx_subscription_types_is_system ON subscription_types(is_system);
    END IF;

    -- Insert default subscription types if they don't exist
    INSERT INTO subscription_types (id, name, description, icon, is_system, created_at)
    VALUES 
        ('boe', 'BOE', 'Boletín Oficial del Estado', 'FileText', true, NOW()),
        ('doga', 'DOGA', 'Diario Oficial de Galicia', 'FileText', true, NOW()),
        ('real-estate', 'Inmobiliaria', 'Búsquedas inmobiliarias', 'Home', true, NOW())
    ON CONFLICT (id) DO NOTHING;

END
$$;

-- Add a trigger to update the updated_at field on subscription_types
DO $$
BEGIN
    -- Create function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
    
    -- Create trigger if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_subscription_types') THEN
        CREATE TRIGGER set_updated_at_subscription_types
        BEFORE UPDATE ON subscription_types
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END
$$;

-- Create subscription_templates table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_templates') THEN
        CREATE TABLE subscription_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            prompts JSONB DEFAULT '[]'::jsonb,
            frequency VARCHAR(20) DEFAULT 'daily',
            icon VARCHAR(50),
            logo TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            is_public BOOLEAN DEFAULT false,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for better performance
        CREATE INDEX idx_subscription_templates_type ON subscription_templates(type);
        CREATE INDEX idx_subscription_templates_is_public ON subscription_templates(is_public);
        CREATE INDEX idx_subscription_templates_created_by ON subscription_templates(created_by);

        -- Add RLS policies
        ALTER TABLE subscription_templates ENABLE ROW LEVEL SECURITY;

        -- Public templates can be viewed by anyone
        CREATE POLICY subscription_templates_select_public ON subscription_templates
            FOR SELECT
            USING (is_public = true);

        -- Users can select their own templates
        CREATE POLICY subscription_templates_select_own ON subscription_templates
            FOR SELECT
            USING (created_by = current_setting('app.current_user_id', TRUE)::uuid);

        -- Only owners can insert their own templates
        CREATE POLICY subscription_templates_insert ON subscription_templates
            FOR INSERT
            WITH CHECK (created_by = current_setting('app.current_user_id', TRUE)::uuid);

        -- Only owners can update their own templates
        CREATE POLICY subscription_templates_update ON subscription_templates
            FOR UPDATE
            USING (created_by = current_setting('app.current_user_id', TRUE)::uuid)
            WITH CHECK (created_by = current_setting('app.current_user_id', TRUE)::uuid);

        -- Only owners can delete their own templates
        CREATE POLICY subscription_templates_delete ON subscription_templates
            FOR DELETE
            USING (created_by = current_setting('app.current_user_id', TRUE)::uuid);

        -- Add trigger for updated_at
        CREATE TRIGGER set_updated_at_subscription_templates
        BEFORE UPDATE ON subscription_templates
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();

        -- Insert default templates
        INSERT INTO subscription_templates 
            (id, type, name, description, prompts, frequency, icon, logo, metadata, is_public, created_at)
        VALUES 
            ('boe-general', 'boe', 'BOE General', 'Seguimiento general del Boletín Oficial del Estado', 
             '["disposición", "ley", "real decreto"]'::jsonb, 'daily', 'GanttChart', 
             'https://www.boe.es/favicon.ico', 
             '{"category": "government", "source": "boe"}'::jsonb, true, NOW()),
            
            ('boe-subvenciones', 'boe', 'Subvenciones BOE', 'Alertas de subvenciones y ayudas públicas', 
             '["subvención", "ayuda", "convocatoria"]'::jsonb, 'immediate', 'Coins', 
             'https://www.boe.es/favicon.ico', 
             '{"category": "government", "source": "boe"}'::jsonb, true, NOW()),
            
            ('real-estate-rental', 'real-estate', 'Alquiler de Viviendas', 'Búsqueda de alquileres en zonas específicas', 
             '["alquiler", "piso", "apartamento"]'::jsonb, 'immediate', 'Key', 
             'https://cdn-icons-png.flaticon.com/512/1040/1040993.png', 
             '{"category": "real-estate", "source": "property-listings"}'::jsonb, true, NOW());
    END IF;
END
$$;

-- Register this migration
INSERT INTO schema_version (version, description)
VALUES ('20250406000000', 'Fixed subscription types and templates tables');