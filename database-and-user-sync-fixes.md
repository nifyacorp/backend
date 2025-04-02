# Database Connection and User Synchronization Fixes

This document summarizes the fixes implemented to address database connection issues in the diagnostic endpoints and user synchronization problems when creating subscriptions.

## 1. Database Connection Fix in Diagnostic Endpoints

### Problem
The `/api/diagnostics/db-status` endpoint was failing with a 500 error showing:
```
Cannot read properties of undefined (reading 'connect')
```

This occurred because the endpoint was trying to use a global pool variable instead of correctly importing it from the database client module.

### Solution
- Updated the `/api/diagnostics/db-status` endpoint to properly import the database pool asynchronously
- Added better error handling for both transaction and connection release operations
- Added validation to ensure the pool exists before trying to use it

### Files Changed
- `/src/interfaces/http/routes/diagnostics.routes.js`

### Implementation
```javascript
// Import pool asynchronously to ensure it's properly initialized
const { pool } = await import('../../../infrastructure/database/client.js');
if (!pool) {
  throw new Error('Database pool is not available');
}

const client = await pool.connect();
// ... rest of transaction code
```

## 2. User Synchronization for Subscription Creation

### Problem
When creating subscriptions, the system was encountering foreign key constraint errors if the user record didn't already exist in the database. This happened because:

1. The authentication service has its own user storage
2. The backend database needed matching user records before subscriptions could be created
3. There was no automatic synchronization between these systems

### Solution
Two-layered approach:

1. **Application Layer Fix**
   - Enhanced `subscription.service.js` to check if a user exists in the database before creating a subscription
   - If the user doesn't exist, it automatically creates a user record with information from the JWT token

2. **Database Layer Fix**
   - Created a database trigger that automatically creates a user record if it doesn't exist when a subscription is created
   - This serves as a fallback mechanism if the application layer check fails

### Files Changed
- `/src/core/subscription/services/subscription.service.js`
- Added new migration: `/supabase/migrations/20250403000000_add_user_creation_trigger.sql`

### Implementation

#### Application Layer (subscription.service.js)
```javascript
// Check if user exists and create if needed
try {
  const userCheck = await query('SELECT id FROM users WHERE id = $1', [subscriptionData.userId]);
  
  if (userCheck.rows.length === 0) {
    logRequest(context, 'User does not exist, creating user record first', { 
      userId: subscriptionData.userId 
    });
    
    // Extract user info from token if available
    const userEmail = context.token?.email || 'auto-created@example.com';
    const userName = context.token?.name || 'Auto-created User';
    
    // Create user record
    await query(
      `INSERT INTO users (
        id,
        email,
        name,
        preferences,
        notification_settings
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        subscriptionData.userId,
        userEmail,
        userName,
        JSON.stringify({}),
        JSON.stringify({
          emailNotifications: true,
          emailFrequency: 'immediate',
          instantNotifications: true,
          notificationEmail: userEmail
        })
      ]
    );
  }
} catch (userError) {
  logError(context, userError, 'Failed to check/create user');
}
```

#### Database Layer (Trigger)
```sql
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in the users table
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id) THEN
    -- Insert a new user record with default values
    INSERT INTO public.users (
      id,
      email,
      name,
      preferences,
      notification_settings
    ) VALUES (
      NEW.user_id, 
      'auto_created@example.com', 
      'Auto-created User', 
      '{}'::jsonb, 
      jsonb_build_object(
        'emailNotifications', true,
        'emailFrequency', 'immediate',
        'instantNotifications', true,
        'notificationEmail', 'auto_created@example.com'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER ensure_user_exists_trigger
BEFORE INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION create_user_if_not_exists();
```

## 3. Authentication Middleware Context Property Fixes

### Problem
The authentication middleware was using `request.context` which is a read-only property in Fastify, causing conflicts and errors.

### Solution
- Changed from using `request.context` to `request.userContext` in all relevant files
- Updated all route handlers to use the correct property

### Files Changed
- `/src/interfaces/http/middleware/auth.middleware.js`
- `/src/interfaces/http/routes/subscription/crud.routes.js`
- `/src/interfaces/http/routes/subscription/crud-delete.js`

## 4. Added Diagnostic Test Script

A test script was created to validate these fixes:

- `/test-diagnostics.js`

This script tests:
1. Database connectivity via the diagnostics endpoints
2. User synchronization by creating a subscription and verifying the user record exists

## How to Test

To run the diagnostic tests:

```bash
# Set environment variables
export AUTH_TOKEN="your_jwt_token"
export USER_ID="your_user_id"

# Run the test script
node test-diagnostics.js
```

The script will check both the database connection and user synchronization, reporting any issues it encounters.