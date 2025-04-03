-- Fix Subscription Creation Issues
-- This migration addresses multiple related issues with subscriptions, types, and templates

-- First ensure the schema_version table exists
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- Part 1: Fix subscription_types table
DO $$
BEGIN
  -- Recreate subscription_types table if structure is incorrect
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_types') THEN
    -- Check if table has required columns and proper types
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'subscription_types' 
      AND column_name = 'name'
    ) THEN
      -- Drop and recreate with proper structure
      DROP TABLE subscription_types CASCADE;
      RAISE NOTICE 'Recreating subscription_types table with correct structure';
    END IF;
  END IF;

  -- Create the table if it doesn't exist or was dropped
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_types') THEN
    CREATE TABLE subscription_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      is_system BOOLEAN DEFAULT false,
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX idx_subscription_types_name ON subscription_types(name);
    CREATE INDEX idx_subscription_types_is_system ON subscription_types(is_system);
    
    -- Add default subscription types
    INSERT INTO subscription_types (id, name, description, icon, is_system, created_at)
    VALUES 
      ('boe', 'BOE', 'Boletín Oficial del Estado', 'FileText', true, NOW()),
      ('doga', 'DOGA', 'Diario Oficial de Galicia', 'FileText', true, NOW()),
      ('real-estate', 'Inmobiliaria', 'Búsquedas inmobiliarias', 'Home', true, NOW());
    
    RAISE NOTICE 'Created subscription_types table and inserted default types';
  ELSE
    -- Make sure default types exist
    INSERT INTO subscription_types (id, name, description, icon, is_system, created_at)
    VALUES 
      ('boe', 'BOE', 'Boletín Oficial del Estado', 'FileText', true, NOW()),
      ('doga', 'DOGA', 'Diario Oficial de Galicia', 'FileText', true, NOW()),
      ('real-estate', 'Inmobiliaria', 'Búsquedas inmobiliarias', 'Home', true, NOW())
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Ensured default subscription types exist';
  END IF;
END
$$;

-- Part 2: Fix subscription_templates table
DO $$
BEGIN
  -- Create subscription_templates table if it doesn't exist
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
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX idx_subscription_templates_type ON subscription_templates(type);
    CREATE INDEX idx_subscription_templates_is_public ON subscription_templates(is_public);
    
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
    
    RAISE NOTICE 'Created subscription_templates table and inserted default templates';
  ELSE
    -- Make sure default templates exist
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
        '{"category": "real-estate", "source": "property-listings"}'::jsonb, true, NOW())
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Ensured default subscription templates exist';
  END IF;
END
$$;

-- Part 3: Fix subscriptions table and ensure foreign key relations
DO $$
BEGIN
  -- Create or update subscriptions table with correct relations
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscriptions') THEN
    CREATE TABLE subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      type_id UUID REFERENCES subscription_types(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      prompts JSONB DEFAULT '[]'::jsonb,
      logo TEXT,
      frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
      active BOOLEAN DEFAULT TRUE,
      settings JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX idx_subscriptions_type_id ON subscriptions(type_id);
    CREATE INDEX idx_subscriptions_active ON subscriptions(active);
    
    RAISE NOTICE 'Created subscriptions table with proper foreign key relations';
  ELSE
    -- Ensure type_id is properly referencing subscription_types
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
      AND table_name = 'subscriptions' 
      AND constraint_name = 'subscriptions_type_id_fkey'
    ) THEN
      -- Add foreign key if missing
      ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_type_id_fkey 
      FOREIGN KEY (type_id) REFERENCES subscription_types(id);
      
      RAISE NOTICE 'Added missing foreign key constraint on subscriptions.type_id';
    END IF;
  END IF;
END
$$;

-- Part 4: Fix subscription_processing table for tracking subscription processing
DO $$
BEGIN
  -- Create the subscription_processing table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_processing') THEN
    CREATE TABLE subscription_processing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      next_run_at TIMESTAMP WITH TIME ZONE,
      last_run_at TIMESTAMP WITH TIME ZONE,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX idx_subscription_processing_subscription_id 
      ON subscription_processing(subscription_id);
    CREATE INDEX idx_subscription_processing_status 
      ON subscription_processing(status);
    CREATE INDEX idx_subscription_processing_next_run_at 
      ON subscription_processing(next_run_at);
    
    RAISE NOTICE 'Created subscription_processing table';
  END IF;
END
$$;

-- Part 5: Auto-create user if missing
DO $$
BEGIN
  -- Create auto user creation function
  CREATE OR REPLACE FUNCTION subscription_ensure_user()
  RETURNS TRIGGER AS $$
  BEGIN
    -- If user doesn't exist, create a placeholder record
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
      INSERT INTO users (id, email, display_name, created_at)
      VALUES (
        NEW.user_id, 
        'auto-created-' || NEW.user_id || '@nifya.com',
        'Auto-created User',
        NOW()
      );
      
      RAISE NOTICE 'Auto-created user record for ID: %', NEW.user_id;
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Create the trigger if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_user_for_subscription') THEN
    CREATE TRIGGER ensure_user_for_subscription
    BEFORE INSERT ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION subscription_ensure_user();
    
    RAISE NOTICE 'Created auto-user creation trigger for subscriptions';
  END IF;
END
$$;

-- Record this migration in schema_version
INSERT INTO schema_version (version, description)
VALUES ('20250407000000', 'Fixed subscription creation issues including types, templates and foreign keys');