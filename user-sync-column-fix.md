# User Synchronization Column Fix

## Issue
The auth middleware was encountering errors when attempting to synchronize users with the database. The error message was:

```
Error: Database operation failed: column "preferences" of relation "users" does not exist
```

This occurred in the `synchronizeUser` function in the auth middleware when attempting to insert new users.

## Root Cause
The schema for the `users` table has been updated in the consolidated schema migration (April 2, 2025), but the auth middleware code was still referencing the old column names. Specifically:

1. The column `preferences` no longer exists in the users table.
2. The column `name` has been renamed to `display_name`.
3. The `notification_settings` column is now expected to be in the `metadata` JSON field.

## Fix Applied
The auth middleware was updated to use the correct column names from the latest schema:

```javascript
// Create the user
await query(
  `INSERT INTO users (
    id,
    email,
    display_name,
    metadata
  ) VALUES ($1, $2, $3, $4)
  ON CONFLICT (id) DO NOTHING`,
  [
    userId,
    email,
    name,
    JSON.stringify({
      emailNotifications: true,
      emailFrequency: 'immediate',
      instantNotifications: true,
      notificationEmail: email
    })
  ]
);
```

## Testing
1. Created a new test file `test-user-sync.js` to validate the user synchronization functionality.
2. Updated the test suite to include a specific test for the `/api/v1/notifications/activity` endpoint that was previously failing.
3. Confirmed that the activity endpoint test now passes with the fix in place.

## Prevention
To prevent similar issues in the future:

1. Database schema changes should be accompanied by corresponding application code updates.
2. Create automated tests for critical database-related operations.
3. Consider using an ORM or query builder that has better column validation.
4. Add explicit schema validation in the middleware after database operations.