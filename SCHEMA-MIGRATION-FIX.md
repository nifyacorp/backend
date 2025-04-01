# Database Schema Migration Fix

This document describes the enhanced startup migration system implemented to fix issues with the existing database migration approach.

## Problem Summary

Based on an analysis of the backend service logs, we identified several critical issues with the existing migration system:

1. **Function Dependencies**: The existing migration files (especially `20250130114438_late_beacon.sql`) relied on the `current_user_id()` function, but this function might not exist yet when migrations are applied.

2. **Column Dependencies**: RLS policies in migrations like `20250324000000_fix_rls_policies.sql` referenced columns (e.g., `is_system`) that didn't exist yet, creating circular dependencies.

3. **Schema Version Tracking**: The system was trying to create the `schema_migrations` table multiple times, indicating issues with the migration tracking system.

## Solution: Enhanced Startup Migration System

We've implemented a comprehensive startup migration system that:

1. **Checks Before Creating**: Verifies if tables/columns exist before trying to modify them
2. **Creates Dependencies First**: Ensures functions and base tables exist before creating dependent objects
3. **Self-contained Migration**: Doesn't rely on existing schema version tracking
4. **Idempotent Operations**: Uses `CREATE IF NOT EXISTS` and similar patterns to ensure safety
5. **Proper Order**: Creates objects in the correct dependency order

## Implementation Details

The enhanced startup migration system consists of:

1. **`startup-migration.js`**: The main migration system that:
   - Creates extensions needed by the database
   - Creates the `current_user_id()` function that RLS policies depend on
   - Creates tables in the correct order (subscription_types → users → subscriptions → notifications → etc.)
   - Sets up RLS policies after all tables exist
   - Uses a transaction to ensure atomic operations

2. **`client.js` updates**:
   - Prioritizes the startup migration system
   - Uses fallback mechanisms if startup migration fails
   - Includes detailed logging for better debugging

## How to Use

### Default Behavior

By default, the backend will now try:
1. Startup migration first (can be disabled with `USE_STARTUP_MIGRATION=false`)
2. Single schema migration as fallback
3. Traditional migrations as last resort

### Testing the Migration

Run the test script to verify the migration works:

```bash
# Run in development environment
NODE_ENV=development node test-migration.js
```

### Deployment with Enhanced Migration

To deploy the backend with the enhanced migration enabled:

```bash
# Run deployment script
./deploy-with-startup-migration.sh
```

### Monitoring

After deployment, monitor the logs to verify successful migration:

```bash
# Change to scripts directory and run log fetcher
cd ../scripts && node get-logs.js backend migration
```

## Fallback Strategy

If the startup migration fails for any reason, the system will automatically fall back to the previous migration methods. This ensures that the service can still start and operate, even if the enhanced migration encounters issues.

## Future Improvements

1. **Schema Documentation**: Consider generating automated schema documentation
2. **Migration Record Cleanup**: Add a utility to clean up duplicate migration records
3. **Schema Validation**: Add more thorough validation of the schema after migration

## Benefits

This enhanced migration system provides:

1. **Resilience**: The system can recover from schema inconsistencies
2. **Flexibility**: Supports both fresh installations and updates to existing databases
3. **Transparency**: Includes detailed logging for better debugging
4. **Reliability**: Ensures dependencies are created in the right order

By using this approach, we can avoid the issues with the existing migration system and ensure the database schema is consistent across all environments.