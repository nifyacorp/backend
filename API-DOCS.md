# NIFYA Backend API Documentation

This document provides a comprehensive guide to the NIFYA backend API, including all available endpoints, authentication requirements, request/response formats, and error handling.

## Table of Contents

- [Authentication Requirements](#authentication-requirements)
- [API Endpoints Overview](#api-endpoints-overview)
  - [Root Endpoints](#root-endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [User Endpoints](#user-endpoints)
  - [Subscription Endpoints](#subscription-endpoints)
  - [Notification Endpoints](#notification-endpoints)
  - [Template Endpoints](#template-endpoints)
  - [Diagnostics Endpoints](#diagnostics-endpoints)
- [Detailed Endpoint Documentation](#detailed-endpoint-documentation)
- [Error Handling](#error-handling)
- [Interactive Documentation](#interactive-documentation)

## Authentication Requirements

Most endpoints require authentication using:
- `Authorization: Bearer <token>` header (note the space after "Bearer")
- `X-User-ID: <user-id>` header

### Important Authentication Header Format

The `Authorization` header must follow this exact format:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Note the space between `Bearer` and the token. Missing this space will result in authentication failures.

### Authentication Refresh Token Endpoints

When access tokens expire, they can be refreshed using:

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| POST | `/api/v1/auth/refresh` | Refresh access token (v1 API) | No |
| POST | `/api/auth/refresh` | Refresh access token (legacy API) | No |

#### POST /api/v1/auth/refresh

Request:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "email_verified": true
  }
}
```

### Common Authentication Errors

| Error Code | Error Message | Description | Solution |
|------------|---------------|-------------|----------|
| 401 | MISSING_HEADERS | Authentication headers are missing or malformed | Ensure both Authorization and X-User-ID headers are provided in the correct format |
| 401 | TOKEN_EXPIRED | JWT token has expired | Get a new token from `/api/auth/login` or use refresh token at `/api/auth/refresh` |
| 401 | USER_MISMATCH | User ID in token doesn't match X-User-ID header | Ensure the user ID in the X-User-ID header matches the user in the JWT token |
| 401 | INVALID_TOKEN | The JWT token is invalid | Get a new valid token from the authentication service |
| 403 | FORBIDDEN | User has insufficient permissions | Request access or use an account with appropriate permissions |

## API Endpoints Overview

### Root Endpoints

These endpoints are available at the root level with no prefix:

- `GET /health` - Health check and system status
- `GET /version` - API version and build information

### Authentication Endpoints

Authentication endpoints are available under the `/api/v1/auth` prefix:

- `POST /api/v1/auth/refresh` - Refresh an expired access token

### User Endpoints

User-related endpoints are available under the `/api/v1/users` prefix:

- `GET /api/v1/users/me` - Get the current user's profile
- `PUT /api/v1/users/me` - Update the current user's profile
- `GET /api/v1/users/preferences` - Get user preferences
- `PUT /api/v1/users/preferences` - Update user preferences
- `GET /api/v1/me/email-preferences` - Get email notification preferences
- `PATCH /api/v1/me/email-preferences` - Update email notification preferences
- `POST /api/v1/me/test-email` - Send a test email

### Subscription Endpoints

Subscription-related endpoints are available under the `/api/v1/subscriptions` prefix:

#### Core CRUD Operations
- `GET /api/v1/subscriptions` - List user subscriptions (with filtering)
- `POST /api/v1/subscriptions` - Create a new subscription
- `GET /api/v1/subscriptions/:id` - Get a specific subscription by ID
- `PUT /api/v1/subscriptions/:id` - Update a subscription
- `DELETE /api/v1/subscriptions/:id` - Delete a subscription
- `DELETE /api/v1/subscriptions/` - Delete all user subscriptions

#### Subscription Status Management
- `PATCH /api/v1/subscriptions/:id/activate` - Activate a subscription
- `PATCH /api/v1/subscriptions/:id/deactivate` - Deactivate a subscription
- `PATCH /api/v1/subscriptions/:id/toggle` - Toggle subscription active status (legacy)

#### Subscription Processing
- `POST /api/v1/subscriptions/:id/process` - Process a subscription immediately
- `GET /api/v1/subscriptions/:id/status` - Get subscription processing status

#### Statistics and Analysis
- `GET /api/v1/subscriptions/stats` - Get subscription statistics
- `GET /api/v1/subscriptions/debug-filter` - Debug endpoint for subscription filters

#### Sharing
- `POST /api/v1/subscriptions/:id/share` - Share a subscription with another user

#### Subscription Types
- `GET /api/v1/subscriptions/types` - List all subscription types
- `POST /api/v1/subscriptions/types` - Create a new subscription type
- `GET /api/v1/subscriptions/types/:id` - Get a specific subscription type

### Notification Endpoints

Notification-related endpoints are available under the `/api/v1/notifications` prefix:

#### Core CRUD Operations
- `GET /api/v1/notifications` - List user notifications (with filtering)
- `GET /api/v1/notifications/:id` - Get a specific notification
- `DELETE /api/v1/notifications/:id` - Delete a notification
- `DELETE /api/v1/notifications/delete-all` - Delete all notifications

#### Notification Status Management
- `PATCH /api/v1/notifications/:id/read` - Mark a notification as read
- `PATCH /api/v1/notifications/read-all` - Mark all notifications as read

#### Statistics and Analytics
- `GET /api/v1/notifications/stats` - Get notification statistics
- `GET /api/v1/notifications/activity` - Get notification activity data

#### Related Notifications
- `GET /api/v1/subscriptions/:id/notifications` - Get notifications for a specific subscription

### Template Endpoints

Template-related endpoints are available under the `/api/v1/templates` prefix:

- `GET /api/v1/templates` - List available subscription templates
- `GET /api/v1/templates/public` - List public subscription templates
- `GET /api/v1/templates/:id` - Get a specific template
- `POST /api/v1/templates` - Create a new template

### Diagnostics Endpoints

Diagnostic endpoints are available under the `/diagnostics` prefix:

- `GET /diagnostics/notifications/:userId` - Test notification retrieval for a specific user
- `POST /diagnostics/notifications/create-test` - Create a test notification
- `GET /diagnostics/subscription-debug/:userId` - Debug subscription retrieval for a specific user
- `GET /diagnostics/user-exists/:userId` - Check if a user exists in the database
- `POST /diagnostics/create-user` - Create a test user
- `GET /diagnostics/subscription-test/*` - Various subscription testing endpoints

⚠️ **Note**: These endpoints are intended for development/staging environments only.

## Detailed Endpoint Documentation

### User Profile Endpoints

#### GET /api/v1/users/me
Returns the authenticated user's profile information including name, email, preferences, and metadata.

Response:
```json
{
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "base64-or-url",
    "bio": "User biography",
    "theme": "light", 
    "language": "es",
    "lastLogin": "2023-09-15T14:22:33Z",
    "emailVerified": true,
    "subscriptionCount": 5,
    "notificationCount": 12,
    "lastNotification": "2023-09-14T08:15:22Z"
  }
}
```

#### PUT /api/v1/users/me
Updates the authenticated user's profile information.

Request:
```json
{
  "name": "Updated Name",
  "bio": "Updated biography",
  "avatar": "base64-or-url"
}
```

Response:
```json
{
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "Updated Name",
    "avatar": "base64-or-url",
    "bio": "Updated biography",
    "theme": "light",
    "language": "es",
    "lastLogin": "2023-09-15T14:22:33Z",
    "emailVerified": true
  }
}
```

### Subscription Request and Response Formats

#### GET /subscriptions

Response format:
```json
{
  "status": "success",
  "data": {
    "subscriptions": [
      {
        "id": "uuid-string",
        "name": "Subscription Name",
        "description": "Description text",
        "prompts": ["search term 1", "search term 2"],
        "frequency": "daily",
        "active": true,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-02T00:00:00Z",
        "type": "boe",
        "typeName": "BOE",
        "source": "BOE"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "filters": {
      "type": null,
      "status": "all",
      "search": null,
      "frequency": "all",
      "dateRange": {
        "from": null,
        "to": null
      }
    }
  }
}
```

#### POST /subscriptions

Request format:
```json
{
  "name": "My BOE Subscription",
  "description": "Get updates on BOE publications",
  "type": "boe",
  "prompts": ["search term 1", "search term 2"],
  "frequency": "daily"
}
```

Alternative request format (compatible with frontend):
```json
{
  "name": "My BOE Subscription",
  "description": "Get updates on BOE publications",
  "source": "boe",           // source is an alias for type
  "keywords": ["search term 1", "search term 2"],  // keywords is an alias for prompts
  "frequency": "daily"
}
```

Response format:
```json
{
  "status": "success",
  "data": {
    "subscription": {
      "id": "uuid-string",
      "name": "My BOE Subscription",
      "description": "Get updates on BOE publications",
      "prompts": ["search term 1", "search term 2"],
      "frequency": "daily",
      "active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z",
      "type": "boe",
      "typeName": "BOE"
    }
  }
}
```

### Query Parameters for GET /subscriptions

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | number | Number of items per page | 20 |
| `page` | number | Page number | 1 |
| `sort` | string | Field to sort by | 'created_at' |
| `order` | string | Sort order ('asc' or 'desc') | 'desc' |
| `type` | string | Filter by subscription type | null |
| `status` | string | Filter by status ('active', 'inactive', 'all') | 'all' |
| `isActive` | boolean | Alternative to status - true = active, false = inactive | null |
| `active` | boolean | Alternative to status and isActive - backwards compatibility | null |
| `frequency` | string | Filter by frequency ('immediate', 'daily', 'all') | 'all' |
| `search` | string | Search term for name/description/prompts | null |
| `from` | date | Filter by created date from | null |
| `to` | date | Filter by created date to | null |

## Error Handling

All API endpoints follow a consistent error response format to make debugging easier. When an error occurs, the system will return a standardized error object with helpful information.

### Standard Error Response Format

```json
{
  "error": {
    "code": "ERROR_TYPE",
    "message": "Human-readable error description",
    "request_id": "unique-request-id",
    "timestamp": "2025-03-15T12:34:56Z",
    "help": {
      "endpoint_info": {
        "description": "Description of the endpoint",
        "auth_required": true|false,
        "method": "GET|POST|PUT|DELETE"
      },
      "related_endpoints": [
        {
          "path": "/related/endpoint",
          "methods": ["GET"],
          "description": "A related endpoint that might help"
        }
      ],
      "documentation_url": "https://docs.nifya.app/api/endpoint-path",
      "required_parameters": [
        {
          "name": "parameter_name",
          "type": "string|number|boolean|object",
          "description": "Description of the parameter"
        }
      ]
    }
  }
}
```

### Common Error Codes and Solutions

#### Authentication Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| MISSING_HEADERS | Authentication headers are missing or malformed | Ensure proper Authorization header (`Bearer {token}`) and X-User-ID header |
| TOKEN_EXPIRED | JWT token has expired | Get a new token or refresh the existing token |
| INVALID_TOKEN | The JWT is invalid or malformed | Ensure the token is properly formatted and has not been tampered with |
| USER_MISMATCH | User ID mismatch between token and header | Ensure X-User-ID matches the user in the token |

#### Request Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| INVALID_INPUT | Request data failed validation | Check the required_parameters in the error help section |
| MISSING_FIELD | A required field is missing | Add the missing field to your request |
| INVALID_FORMAT | A field has an incorrect format | Correct the format as specified in the error message |
| RESOURCE_NOT_FOUND | The requested resource does not exist | Verify the resource ID or path |
| DUPLICATE_RESOURCE | A resource with the same unique identifier already exists | Use a different identifier or update the existing resource |

#### Server Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| DATABASE_ERROR | Error connecting to the database | Retry the request; if persistent, contact support |
| INTERNAL_ERROR | Unexpected server error | Retry the request; if persistent, contact support with the request_id |
| SERVICE_UNAVAILABLE | Service temporarily unavailable | Retry after a short delay |

## Interactive Documentation

The NIFYA backend includes a comprehensive interactive API documentation system based on OpenAPI/Swagger.

### Accessing Interactive Documentation

#### During Development

When running the application locally, the documentation is available at:

- **API Endpoints**: http://localhost:8080/documentation
- **Database Schema**: http://localhost:8080/documentation/database
- **Entity Relationships**: http://localhost:8080/documentation/relationships
- **Implementation Guides**: http://localhost:8080/documentation/guides

#### Production Environment

The documentation is also available in the production environment at:

- **API Endpoints**: https://backend-415554190254.us-central1.run.app/documentation
- **Database Schema**: https://backend-415554190254.us-central1.run.app/documentation/database
- **Entity Relationships**: https://backend-415554190254.us-central1.run.app/documentation/relationships
- **Implementation Guides**: https://backend-415554190254.us-central1.run.app/documentation/guides

### Using the Documentation

#### Making Test Requests

1. Navigate to the API endpoint documentation
2. Choose an endpoint to test
3. Click "Try it out"
4. Fill in required parameters
5. Add authentication headers
6. Click "Execute"

#### Authentication for Testing

When testing endpoints through the documentation UI, you need to:

1. Provide the `Authorization` header with a valid JWT token in the format `Bearer <token>`
2. Include the `x-user-id` header with the user ID

---

## Note on Route Standardization

This endpoint documentation reflects the standardized routing system that improves clarity and consistency. All primary API endpoints follow the `/api/v1/{resource}` pattern, with clear separation of administrative and diagnostic routes.

Frontend applications should use these documented endpoints for all API requests. 