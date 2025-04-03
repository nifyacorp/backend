-- Create or fix missing tables for template service
-- This migration ensures the required tables for templates exist

-- Create subscription_templates table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_templates'
    ) THEN
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
            USING (auth.uid() = created_by);

        -- Only owners can insert their own templates
        CREATE POLICY subscription_templates_insert ON subscription_templates
            FOR INSERT
            WITH CHECK (auth.uid() = created_by);

        -- Only owners can update their own templates
        CREATE POLICY subscription_templates_update ON subscription_templates
            FOR UPDATE
            USING (auth.uid() = created_by)
            WITH CHECK (auth.uid() = created_by);

        -- Only owners can delete their own templates
        CREATE POLICY subscription_templates_delete ON subscription_templates
            FOR DELETE
            USING (auth.uid() = created_by);

        -- Insert some default templates if there are none
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

-- Ensure basic subscription types exist
DO $$
BEGIN
    -- Check if the subscription_types table is empty
    IF NOT EXISTS (SELECT 1 FROM subscription_types LIMIT 1) THEN
        -- Insert basic subscription types
        INSERT INTO subscription_types (name, description, icon, is_system, created_at)
        VALUES 
            ('BOE', 'Boletín Oficial del Estado', 'FileText', true, NOW()),
            ('DOGA', 'Diario Oficial de Galicia', 'FileText', true, NOW()),
            ('Inmobiliaria', 'Búsquedas inmobiliarias', 'Home', true, NOW());
    END IF;
END
$$;

-- Add a trigger to update the updated_at field
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_updated_at_subscription_templates'
    ) THEN
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER set_updated_at_subscription_templates
        BEFORE UPDATE ON subscription_templates
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END
$$;