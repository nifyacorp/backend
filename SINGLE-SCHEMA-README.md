# NIFYA Single Schema Approach

## Overview

The NIFYA project now supports a **Single Schema Approach** for database management. This approach replaces the traditional multiple migration files with a single comprehensive schema file that defines the entire database structure.

## Why Single Schema?

The single schema approach offers several advantages:

1. **Simplified Database Setup**: One file contains everything needed to create the database
2. **Faster Startup**: No need to apply dozens of migrations sequentially
3. **Reduced Complexity**: Easier to understand the complete database structure
4. **Lower Error Risk**: Fewer points of failure during database initialization
5. **Easier Deployments**: Cloud Run deployments no longer time out waiting for migrations

## Files

- **`supabase/complete-schema.sql`**: The complete database schema definition
- **`src/infrastructure/database/single-schema-migrations.js`**: Implementation for using single schema
- **`database-rebuild.js`**: Script to rebuild the database using the single schema
- **`deploy-with-single-schema.sh`**: Deployment script that uses the single schema approach

## How to Use

### Rebuilding the Database

To completely rebuild the database with the new schema:

```bash
# Without data migration (empty database)
node database-rebuild.js

# With data migration from existing database dump
node database-rebuild.js --with-data
```

This will:
1. Back up your current database (if possible)
2. Drop and recreate the database
3. Apply the complete schema
4. Optionally migrate data from the old database

### Deploying the Application

To deploy the application with the single schema approach:

```bash
./deploy-with-single-schema.sh
```

This will:
1. Ensure the schema file exists
2. Configure the application to use the single schema approach
3. Start the application with delayed migrations

### Switching Between Approaches

You can easily switch between the single schema and multiple migrations approaches by changing the `USE_SINGLE_SCHEMA` constant in `src/infrastructure/database/client.js`:

```javascript
// Set to true to use single schema, false to use multiple migrations
const USE_SINGLE_SCHEMA = true;
```

## Maintaining the Schema

When you need to make changes to the database structure:

1. Edit `supabase/complete-schema.sql` to include your changes
2. Test the changes locally using `node database-rebuild.js`
3. Deploy with `./deploy-with-single-schema.sh`

## Migrating from Multiple Migrations

To migrate from the old multiple migrations approach:

1. Create a database backup
2. Run `node database-rebuild.js --with-data`
3. Review the new database to ensure everything migrated correctly
4. Deploy with `./deploy-with-single-schema.sh`
5. Once confirmed working, you can optionally archive the old migration files