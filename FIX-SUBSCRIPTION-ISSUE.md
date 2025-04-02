# Subscription Issue Fix

## Issue Description

The NIFYA platform was experiencing a critical issue that prevented the creation of new subscriptions. The error was:

```
Database operation failed: column "logo" of relation "subscriptions" does not exist
```

This indicated a mismatch between the application code and the database schema.

## Solution Implemented

### 1. Database Migration

A new migration (`20250403000000_fix_subscription_schema.sql`) has been created to address the schema issues:

```sql
-- Add logo column to subscriptions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'logo'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN logo VARCHAR(255);
  END IF;
END $$;
```

This migration adds the missing `logo` column to the subscriptions table if it doesn't already exist.

### 2. Code Changes

The `subscription.service.js` file has been updated to:

1. Ensure prompts are always stored in the correct format
2. Handle missing database columns gracefully
3. Add better error handling for database schema mismatches

Key improvements:

```javascript
// Check if columns exist before attempting insert
const columnQuery = `
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'subscriptions'
`;
const columnResult = await query(columnQuery);
const availableColumns = columnResult.rows.map(r => r.column_name);

// Filter subscription object to only include columns that exist in the database
const validFields = Object.keys(subscription).filter(field => 
  availableColumns.includes(field)
);
```

### 3. Testing

A test script has been created to verify the fix:

```
node test-subscription-creation.js
```

This script:
1. Authenticates with the authentication service
2. Fetches the user profile
3. Attempts to create a subscription
4. Verifies the response

## How to Apply the Fix

1. Run the new database migration:

```bash
cd backend
npm run db:migrate
```

Or manually apply the SQL in the `20250403000000_fix_subscription_schema.sql` file.

2. Deploy the updated code:

```bash
cd backend
./deploy-with-version.sh
```

3. Verify the fix:

```bash
node test-subscription-creation.js
```

## Preventing Future Issues

To prevent similar issues in the future:

1. Implement schema validation in the CI/CD pipeline
2. Add database migration tests that verify consistency between code models and database schema
3. Use a type-safe ORM or query builder that can detect schema issues at compile time
4. Add better error handling and reporting for database-related errors

## Related Issues

This fix also addresses the broader notification pipeline issues by ensuring subscriptions can be created. Follow-up work is still needed on:

1. Schema consistency across the notification pipeline
2. Missing DLQ resources for error handling
3. Authentication issues in the BOE Parser