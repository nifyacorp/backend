# CORS and API Routing Fix

## Issues Fixed

This update addresses issues related to CORS and API routing inconsistencies between the frontend and backend.

### 1. CORS Headers Issue

- **Issue**: CORS policy was blocking requests with the `headers` field in the preflight request
- **Error**: `Access to fetch at 'https://backend-415554190254.us-central1.run.app/v1/me/email-preferences' from origin 'https://main-page-415554190254.us-central1.run.app' has been blocked by CORS policy: Request header field headers is not allowed by Access-Control-Allow-Headers in preflight response.`
- **Impact**: Frontend couldn't communicate with the backend for email preferences
- **Fix**: 
  - Added 'headers' to the list of allowed headers in the CORS configuration
  - This allows the frontend to include the 'headers' field in the preflight request

### 2. API Route Inconsistency

- **Issue**: Frontend was requesting endpoints at `/v1/me/email-preferences` but backend expected `/api/v1/me/email-preferences`
- **Error**: `Failed to load resource: net::ERR_FAILED` for `/v1/me/email-preferences`
- **Impact**: Email preferences couldn't be fetched or updated
- **Fix**: 
  - Added compatibility routes at `/v1/me/email-preferences` that forward to the existing handlers
  - Maintained the original routes at `/api/v1/me/email-preferences` for backward compatibility

## Implementation Details

### 1. CORS Configuration Update

The ALLOWED_HEADERS constant in `src/shared/constants/headers.js` was updated to include the 'headers' field:

```javascript
export const ALLOWED_HEADERS = [
  AUTH_HEADER,
  USER_ID_HEADER,
  CONTENT_TYPE,
  ACCEPT,
  X_REQUESTED_WITH,
  'headers' // Added to allow it in preflight requests
];
```

### 2. Added Compatibility Routes

The main application file was updated to register additional routes for the `/v1` path prefix:

```javascript
// Original routes
fastify.get('/api/v1/me/email-preferences', getEmailPreferences);
fastify.patch('/api/v1/me/email-preferences', updateEmailPreferences);
fastify.post('/api/v1/me/test-email', sendTestEmail);

// Added compatibility routes
fastify.get('/v1/me/email-preferences', getEmailPreferences);
fastify.patch('/v1/me/email-preferences', updateEmailPreferences);
fastify.post('/v1/me/test-email', sendTestEmail);
```

## Impact of Changes

These changes ensure that:

1. CORS preflight requests with the 'headers' field will be accepted
2. The frontend can communicate with the backend using either `/api/v1` or `/v1` path prefixes
3. Existing functionality is maintained (no breaking changes)

## Recommendations for Future Development

1. **Standardize API Path Prefixes**: Ensure all frontend API calls use a consistent path prefix (either `/api/v1` or `/v1`)
2. **Document API Routes**: Add clear documentation for all API routes with their expected path formats
3. **Add Comprehensive CORS Testing**: Include tests to verify CORS behavior for all API endpoints
4. **Consider API Gateway**: For larger scale deployments, consider using an API gateway to handle routing and CORS in a centralized way