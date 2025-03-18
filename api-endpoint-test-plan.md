# API Endpoint Test Plan

This document outlines the testing strategy for the NIFYA backend API endpoints, focusing on the recently fixed issues.

## Test Environment Setup

1. Start the backend server with the test database:
   ```bash
   cd backend
   NODE_ENV=development SKIP_DB_VALIDATION=true PORT=3000 node src/index.js
   ```

2. Use curl, Postman, or a similar tool to test the API endpoints

## Test Cases

### 1. Notification Stats Endpoint

**Endpoint:** GET /api/v1/notifications/stats
**Purpose:** Verify that the stats endpoint returns proper statistics without 500 errors

#### Test Steps:
1. Send authenticated GET request to `/api/v1/notifications/stats`
2. Verify the response structure includes:
   - total (number)
   - unread (number)
   - change (number)
   - isIncrease (boolean)
   - byType (object)
3. Check response status code is 200
4. Try with invalid token and verify 401 response

```bash
# Using curl with a valid token
curl -X GET http://localhost:3000/api/v1/notifications/stats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Notification Activity Endpoint

**Endpoint:** GET /api/v1/notifications/activity
**Purpose:** Verify that the activity endpoint returns proper data without 500 errors 

#### Test Steps:
1. Send authenticated GET request to `/api/v1/notifications/activity?days=7`
2. Verify the response structure includes:
   - activityByDay (array of objects with day and count)
   - sources (array of objects with name, count, and color)
3. Check response status code is 200
4. Try with invalid token and verify 401 response

```bash
# Using curl with a valid token
curl -X GET http://localhost:3000/api/v1/notifications/activity?days=7 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Subscription Stats Endpoint

**Endpoint:** GET /api/v1/subscriptions/stats
**Purpose:** Verify that the new subscription stats endpoint works correctly

#### Test Steps:
1. Send authenticated GET request to `/api/v1/subscriptions/stats`
2. Verify the response structure includes:
   - total (number)
   - active (number)
   - inactive (number)
   - bySource (object)
   - byFrequency (object)
3. Check response status code is 200
4. Try with invalid token and verify 401 response

```bash
# Using curl with a valid token
curl -X GET http://localhost:3000/api/v1/subscriptions/stats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Route Conflict Resolution

**Purpose:** Verify that the route conflicts have been resolved

#### Test Steps:
1. Monitor the server startup process to ensure there are no errors related to duplicate route declarations
2. Check server logs for any route registration errors
3. Verify that all routes are properly registered by inspecting the server startup logs

### 5. Frontend Integration Test

**Purpose:** Verify that the frontend can successfully communicate with the backend endpoints

#### Test Steps:
1. Start the frontend development server
2. Navigate to the dashboard page
3. Open browser developer tools and watch the network requests
4. Verify that requests to the following endpoints succeed:
   - `/api/v1/notifications/stats`
   - `/api/v1/notifications/activity`
   - `/api/v1/subscriptions/stats`
5. Check browser console for any API-related errors

## Regression Testing

To ensure our fixes don't break existing functionality, test the following scenarios:

1. Get notification list
2. Mark a notification as read
3. Get subscription list
4. Create a new subscription
5. Update a subscription
6. Toggle subscription active status
7. Delete a subscription

## Performance Testing

For the modified endpoints, verify performance under load:

1. Test with a large number of notifications (>100)
2. Test with multiple concurrent requests
3. Monitor response times to ensure they remain acceptable

## Documentation Update

After testing is complete:

1. Update API documentation with the correct endpoint signatures
2. Document the expected response formats for all endpoints
3. Add appropriate error response information
4. Update any frontend code that might be relying on the updated endpoints