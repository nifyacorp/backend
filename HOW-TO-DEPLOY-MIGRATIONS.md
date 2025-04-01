# How to Deploy Database Migrations

This guide explains how to deploy the new consolidated database migration system safely.

## Option 1: Production-Safe Update (Recommended)

This approach keeps existing data but updates the migration system. We've implemented this as the default approach in the service.

### Automated Deployment

Simply use the provided deployment script:

```bash
# Run the safe deployment script
./deploy-with-safe-migrations.sh
```

This script will:
1. Create a database backup
2. Ensure the production-safe migration system is in place
3. Update client.js to use the safe migrations
4. Check for and use the fixed JSON syntax in migrations
5. Build and deploy the application

### Manual Steps (if needed)

If you prefer to do this manually:

```bash
# 1. Backup your database first
pg_dump -U postgres -d your_database_name -f backup_before_migration_update.sql

# 2. Apply the schema_version migration
psql -U postgres -d your_database_name -f supabase/migrations/20250401500000_create_schema_version.sql

# 3. Import the fixed single migration that was causing problems
psql -U postgres -d your_database_name -f supabase/migrations/20250401000000_add_entity_type_column.sql

# 4. Update the code to use the improved migration system
cp src/infrastructure/database/safe-migrations.js src/infrastructure/database/migrations.js
# Or update imports in client.js to use safe-migrations.js

# 5. Deploy the application
./deploy-with-version.sh
```

This approach:
- Preserves all existing data
- Adds the schema_version tracking table
- Fixes the JSON syntax error in the migration file
- Updates to the improved migration system

## Option 2: Fresh Installation with Consolidated Schema

Use this approach for new environments or when you want to reset the database.

```bash
# 1. Backup your database if it contains any important data
pg_dump -U postgres -d your_database_name -f backup_before_reset.sql

# 2. Run the application script to apply the consolidated schema
node apply-new-migration-system.js --force

# 3. Deploy the application
./deploy-with-version.sh
```

WARNING: This approach deletes all existing data and creates a fresh database schema.

## Option 3: Manual Migration Fix

If you're experiencing issues with a specific deployment:

```bash
# 1. Fix the problematic migration file
cp supabase/migrations/20250401000000_add_entity_type_column.sql.fixed supabase/migrations/20250401000000_add_entity_type_column.sql

# 2. Create the schema_version table manually
psql -U postgres -d your_database_name -c "
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);
"

# 3. Register the problematic migration as applied
psql -U postgres -d your_database_name -c "
INSERT INTO schema_version (version, description) 
VALUES ('20250401000000', 'Add entity_type column to notifications')
ON CONFLICT (version) DO NOTHING;
"

# 4. Deploy the application
./deploy-with-version.sh
```

## Verifying the Migration

After deploying, you can verify the migration status:

```bash
# Check the schema_version table
psql -U postgres -d your_database_name -c "SELECT * FROM schema_version ORDER BY applied_at;"

# Check if the entity_type column exists
psql -U postgres -d your_database_name -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' AND column_name = 'entity_type';
"
```

## Troubleshooting

If you encounter issues during deployment:

1. **Migration Fails with "relation schema_version does not exist"**:
   - Create the schema_version table manually using Option 3
   - Re-deploy

2. **JSON Syntax Errors**:
   - Ensure you're using the fixed migration file (`20250401000000_add_entity_type_column.sql`)
   - Use proper JSON syntax with single quotes around JSON objects and double quotes for keys

3. **Tables Missing After Deployment**:
   - Restore from your backup
   - Try Option 1 instead of Option 2

## Going Forward

For all future migrations:

1. Always use proper JSON syntax:
   ```sql
   -- CORRECT:
   DEFAULT '{"key": "value"}'::jsonb
   
   -- INCORRECT:
   DEFAULT {key: value}::jsonb
   ```

2. Make migrations idempotent with checks:
   ```sql
   -- Always use IF NOT EXISTS or similar checks
   CREATE TABLE IF NOT EXISTS my_table (...);
   ```

3. Add proper comments explaining the purpose of each migration

4. Run the validation script before deploying:
   ```bash
   node test-migrations.js
   ```