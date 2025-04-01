# Database Migration System Update

This guide outlines how to implement the consolidated database migration system to replace the current incremental approach. This change will make deployments more reliable and database management more maintainable.

## What's New

1. **Consolidated Schema**: A single source of truth for the entire database schema
2. **Improved Migration System**: Better error handling, transaction support, and version control
3. **Migration Validation**: Pre-deployment testing to catch errors before they cause outages
4. **Proper JSON Handling**: Fixed issues with JSON syntax in SQL

## Implementation Steps

### 1. Fix Immediate Issue (Required)

The current deployment is failing due to a JSON syntax error in the migration file. Apply this fix immediately:

```bash
# Copy the fixed file over the problematic one
cp supabase/migrations/20250401000000_add_entity_type_column.sql.fixed supabase/migrations/20250401000000_add_entity_type_column.sql

# Deploy again
./deploy-with-version.sh
```

### 2. Implement the Improved Migration System (Recommended)

Replace the current migration system with the improved version:

```bash
# Copy the new migration system to replace the old one
cp src/infrastructure/database/improved-migrations.js src/infrastructure/database/migrations.js

# Update the import in src/infrastructure/database/client.js
# Change: import { initializeMigrations } from './migrations.js';
# To: import { initializeMigrations } from './improved-migrations.js';
```

### 3. Validate Migrations Before Deployment (Optional but Recommended)

Test all migrations for syntax errors and common issues:

```bash
# Run the validation script
node test-migrations.js
```

### 4. Prepare for Consolidated Schema (Future)

For new environments or when a schema reset is acceptable, use the consolidated schema:

```bash
# This will reset the database schema and apply the consolidated version
# WARNING: Only use in development or new environments!
psql -U postgres -d your_database -c "SET app.allow_schema_reset = 'true';"
psql -U postgres -d your_database -f supabase/migrations/20250402000000_consolidated_schema_reset.sql
```

## How It Works

### Consolidated Schema

The `consolidated_schema.sql` file contains the complete database schema definition:

- All tables, indexes, and constraints
- Row Level Security (RLS) policies
- Default data
- Version tracking

### Improved Migration System

The new system in `improved-migrations.js` provides:

1. **Transaction Support**: All migrations run in transactions for atomicity
2. **Version Tracking**: Migrations are tracked in the `schema_version` table
3. **Error Enhancement**: Better error messages with line numbers and context
4. **Consolidated Schema Support**: Special handling for schema reset migrations

### Migration Validation

The `test-migrations.js` script checks for:

1. **SQL Syntax Errors**: Validates SQL before deployment
2. **JSON Syntax Issues**: Catches the type of error that caused the current outage
3. **Idempotence Problems**: Warns about operations that might fail if run multiple times
4. **RLS Configuration**: Checks for incomplete RLS setup

## Best Practices

1. **Always Run Validation**: Use `node test-migrations.js` before deploying
2. **Use IF NOT EXISTS**: Make all CREATE statements idempotent
3. **Use Proper JSON Syntax**: Always quote JSON keys and values
4. **Add Transaction Support**: Wrap related operations in transactions
5. **Document Changes**: Add comments explaining the purpose of each migration

## Troubleshooting

### Deployment Failures

If a deployment fails due to a migration error:

1. Check the error message for the specific issue
2. Look for line numbers and context in the error
3. Fix the issue in the migration file
4. Run the validation script before deploying again

### JSON Syntax Errors

When using JSON in SQL:

- Always use single quotes around the entire JSON: `'{"key": "value"}'::jsonb`
- Always use double quotes for JSON keys and string values
- Use parentheses for concatenation: `'prefix:' || (metadata->>'field')`

### RLS Issues

If users can't access data after migration:

1. Check if RLS is enabled on tables
2. Verify policies exist for the tables
3. Test access with different user contexts

## Conclusion

This migration system update provides a more robust foundation for database management. By addressing the current issues and implementing better practices, we can avoid deployment failures and maintain a cleaner codebase.