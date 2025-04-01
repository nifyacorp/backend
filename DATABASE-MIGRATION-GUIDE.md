# NIFYA Database Migration Guide

## Overview

The NIFYA project uses a production-safe database migration system that ensures database changes are applied reliably and consistently across all environments. This document explains how the migration system works and provides guidelines for creating and applying migrations.

## Migration System Features

- **Schema Version Tracking**: All migrations are recorded in a `schema_version` table
- **Idempotent Migrations**: Migrations can be safely re-run without causing errors
- **Transaction Support**: Most migrations run within transactions for atomicity
- **Special Migrations**: Support for migrations that can't be run in transactions
- **Error Handling**: Detailed error reporting with line numbers and context
- **Automatic Backups**: The deployment script creates database backups before running migrations

## Migration Files

Migration files are stored in the `supabase/migrations` directory and follow this naming convention:

```
YYYYMMDDXXXXXX_descriptive_name.sql
```

Where:
- `YYYYMMDD` is the date (e.g., 20250401)
- `XXXXXX` is a sequence number for ordering migrations from the same day
- `descriptive_name` is a brief description using snake_case

## Special Migration Files

There are a few special migration files that are handled differently:

1. **Schema Version Table Creation**: `20250401500000_create_schema_version.sql`
   - This creates the table that tracks which migrations have been applied
   - Always runs first and automatically handles cases where the table already exists

2. **Migration System Fix**: `20250402000001_migration_system_fix.sql`
   - Resolves any issues with the migration system itself
   - Runs second and handles migration system consistency checks

3. **Consolidated Schema**: `20250301000000_consolidated_schema.sql`
   - Contains a complete snapshot of the database schema
   - Used for full database initialization or resets

## Creating New Migrations

When creating a new migration:

1. Create a new SQL file in the `supabase/migrations` directory
2. Use the naming convention: `YYYYMMDD000000_descriptive_name.sql`
3. Include a header comment explaining the purpose of the migration
4. Write idempotent SQL statements when possible (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.)
5. Test the migration locally using the test script

Example migration file:
```sql
/*
  # Add New Column to Users Table (April 3, 2025)
  
  This migration adds a new column for storing user preferences.
*/

-- Add column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING gin(preferences);

-- Register this migration (handled automatically, but included for clarity)
INSERT INTO schema_version (version, description)
VALUES ('20250403000000', 'Add preferences column to users table')
ON CONFLICT (version) DO NOTHING;
```

## Testing Migrations

To test migrations locally:

1. Make sure PostgreSQL is running
2. Configure your database connection in `.env`
3. Run `node test-migrations.js`

This script will:
- Create a fresh test database
- Import the current SQL dump (if available)
- Run all migrations
- Report success or errors

## Applying Migrations in Production

Migrations are automatically applied when the application starts or when the deployment script is run:

```bash
./deploy-with-safe-migrations.sh
```

The deployment script will:
1. Create a database backup if possible
2. Verify migration files exist
3. Install dependencies if needed
4. Build the application if needed
5. Start the application with production settings, which runs migrations

## Troubleshooting

If migrations fail:

1. Check the error message for line numbers and details
2. Look for SQL syntax errors or constraint violations
3. Check if the migration assumes tables or columns exist that don't
4. Verify that the migration is idempotent (can be run multiple times)
5. Try running the migration manually using `psql`

## Migration Best Practices

1. **Make migrations idempotent**: Use `IF NOT EXISTS`, `IF EXISTS`, and `ON CONFLICT` clauses
2. **Use transactions**: Most migrations should be wrapped in transactions
3. **Include comments**: Document the purpose of each migration
4. **Test locally**: Always test migrations locally before deploying
5. **Backup data**: Always back up the database before applying migrations
6. **Small, focused changes**: Each migration should make a small, focused change
7. **Avoid destructive changes**: Prefer adding columns over dropping them

## Common Migration Patterns

### Adding a New Table
```sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Adding a Column
```sql
ALTER TABLE existing_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(100);
```

### Adding Constraints
```sql
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

### Creating Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Adding Row-Level Security
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY IF NOT EXISTS users_isolation_policy 
ON users 
FOR ALL 
USING (id = current_setting('app.current_user_id', true)::uuid);
```