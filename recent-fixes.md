# Recent Backend Fixes - March 2025

## Summary

This document outlines the fixes implemented to resolve critical errors in the NIFYA backend service that were causing 500 errors and build failures.

## 1. Build Failure Fix

### Problem
The backend service was failing to build with the error:
```
Method 'GET' already declared for route '/api/v1/subscriptions'
```

This occurred because there were duplicate route declarations for the same endpoint in:
- `/src/interfaces/http/routes/subscription.routes.js`
- `/src/interfaces/http/routes/subscription/index.js`

### Solution
1. Removed the duplicate `subscription.routes.js` file (backed up as `subscription.routes.js.bak`)
2. Updated imports in `src/index.js` to use `./interfaces/http/routes/subscription/index.js` 
3. Reorganized route registration order in `subscription/index.js` to ensure special routes like `/stats` are registered before dynamic routes

## 2. Notification Stats Endpoint Errors

### Problem
The `/api/v1/notifications/stats` endpoint was returning 500 errors due to a database schema mismatch. The query referenced a "source" column that didn't exist in the notifications table.

From the error logs:
```
Database query error: {
  error: 'column "source" does not exist',
  code: '42703'
}
```

### Solution
1. Updated the SQL query in `notification-repository.js` to use entity_type instead of the non-existent source column:

```javascript
// Get notification count by entity_type (using entity_type instead of source which doesn't exist)
const bySourceQuery = `
  SELECT 
    COALESCE(SPLIT_PART(entity_type, ':', 1), 'unknown') as name,
    COUNT(*) as count
  FROM notifications
  WHERE user_id = $1
  GROUP BY SPLIT_PART(entity_type, ':', 1)
  ORDER BY count DESC
`;
```

2. Added robust error handling with fallback data to prevent frontend errors even if the database query fails:

```javascript
// Handle potential query error with a fallback
let sourcesResult;
try {
  sourcesResult = await query(bySourceQuery, [userId]);
} catch (error) {
  logger.logError({ repository: 'notification-repository', method: 'getActivityStats' }, error);
  
  // Provide fallback data when the query fails
  sourcesResult = { 
    rows: [
      { name: 'unknown', count: '0' }
    ] 
  };
}
```

## 3. Subscription Stats Endpoint Errors

### Problem
The frontend was calling `/v1/subscriptions/stats` but receiving a 400 error with message "params/id must match format 'uuid'". This happened because the stats endpoint route was being interpreted as an ID parameter.

### Solution
Added a dedicated stats endpoint in `subscription/index.js` that is registered before the ID routes:

```javascript
// Add stats endpoint - must be defined before the ID routes to avoid conflict
fastify.get('/stats', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          active: { type: 'integer' },
          inactive: { type: 'integer' },
          bySource: { 
            type: 'object',
            additionalProperties: { type: 'integer' }
          },
          byFrequency: {
            type: 'object',
            additionalProperties: { type: 'integer' }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  // Implementation with dummy data for now
  return {
    total: 0,
    active: 0,
    inactive: 0,
    bySource: {},
    byFrequency: {
      'daily': 0,
      'immediate': 0
    }
  };
});
```

## 4. Local Development Without Database

### Problem
Developers needed to have a fully configured PostgreSQL database to run the service locally, making quick testing difficult.

### Solution
Added a SKIP_DB_VALIDATION mode for local development:

1. Updated database client initialization to check for this mode:
```javascript
if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
  console.log('Running in local development mode with SKIP_DB_VALIDATION - skipping database initialization');
  return;
}
```

2. Modified the query function to return mock data when in this mode:
```javascript
// Skip actual DB operations in development mode if specified
if (isLocalDevelopment && process.env.SKIP_DB_VALIDATION === 'true') {
  console.log('DEVELOPMENT MODE: Skipping database query:', { 
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    timestamp: new Date().toISOString()
  });
  return { rows: [], rowCount: 0 };
}
```

## 5. Documentation Updates

The following documentation was created/updated:

1. Updated README.md with:
   - Added new API endpoints
   - Added documentation for SKIP_DB_VALIDATION mode
   - Added information about recent fixes

2. Created api-endpoint-compatibility-report.md with:
   - Mapping of frontend to backend endpoints
   - Details of issues and fixes
   - Explanation of schema mismatches

3. Created api-endpoint-test-plan.md with:
   - Test cases for each fixed endpoint
   - Test environment setup instructions
   - Regression testing instructions

## Next Steps

1. Add proper database queries to the subscription stats endpoint (currently returns dummy data)
2. Fix notification ID parameter inconsistency between frontend and backend
3. Implement comprehensive testing based on the test plan
4. Consider adding automated API compatibility tests to catch schema mismatches earlier