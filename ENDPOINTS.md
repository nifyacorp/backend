# NIFYA Backend API Endpoints

This document provides a comprehensive list of all endpoints available in the NIFYA backend API.

## Table of Contents

- [Authentication Requirements](#authentication-requirements)
- [Notification Endpoints](#notification-endpoints)
- [Subscription Endpoints](#subscription-endpoints)
- [User Endpoints](#user-endpoints)
- [Template Endpoints](#template-endpoints)
- [API Explorer Endpoints](#api-explorer-endpoints)
- [Diagnostics Endpoints](#diagnostics-endpoints)

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

### Common Authentication Errors

| Error Code | Error Message | Description | Solution |
|------------|---------------|-------------|----------|
| 401 | MISSING_HEADERS | Authentication headers are missing or malformed | Ensure both Authorization and X-User-ID headers are provided in the correct format |
| 401 | TOKEN_EXPIRED | JWT token has expired | Get a new token from `/api/auth/login` or use refresh token at `/api/auth/refresh` |
| 401 | USER_MISMATCH | User ID in token doesn't match X-User-ID header | Ensure the user ID in the X-User-ID header matches the user in the JWT token |
| 401 | INVALID_TOKEN | The JWT token is invalid | Get a new valid token from the authentication service |
| 403 | FORBIDDEN | User has insufficient permissions | Request access or use an account with appropriate permissions |

## Notification Endpoints

```
GET /notifications → List notifications
  ↓
PATCH /notifications/:id/read → Mark as read
  ↓
DELETE /notifications/:id → Delete notification
  ↓
GET /notifications/stats → View notification stats
```

### Notification Management

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/notifications` | Get user notifications with filtering options | Yes |
| PATCH | `/notifications/:id/read` | Mark a notification as read | Yes |
| DELETE | `/notifications/:id` | Delete a notification | Yes |
| DELETE | `/notifications/delete-all` | Delete all notifications for a user | Yes |
| GET | `/notifications/stats` | Get notification statistics | Yes |
| GET | `/notifications/activity` | Get notification activity statistics | Yes |
| POST | `/notifications/read-all` | Mark all notifications as read | Yes |
| POST | `/notifications/realtime` | Send realtime notification via WebSocket | Yes |

### Query Parameters for GET /notifications

- `limit`: Number of items per page (default: 10)
- `page`: Page number (default: 1)
- `offset`: Alternative to page, starting index
- `unread`: Filter by read status (true/false)
- `subscriptionId`: Filter by subscription

## Subscription Endpoints

```
GET /subscriptions → List subscriptions
  ↓
POST /subscriptions → Create subscription
  ↓
GET /subscriptions/:id → View details
  ↓
PATCH /subscriptions/:id → Update
  ↓
DELETE /subscriptions/:id → Delete
  ↓
POST /subscriptions/:id/process → Process
```

### Subscription CRUD Operations

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/subscriptions` | List user subscriptions with filtering options | Yes |
| POST | `/subscriptions` | Create a new subscription | Yes |
| GET | `/subscriptions/:id` | Get subscription details | Yes |
| PATCH | `/subscriptions/:id` | Update subscription | Yes |
| PATCH | `/subscriptions/:id/toggle` | Toggle subscription active status | Yes |
| DELETE | `/subscriptions/:id` | Delete subscription | Yes |

### Subscription Processing

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| POST | `/subscriptions/:id/process` | Process a subscription immediately | Yes |
| POST | `/subscriptions/process/:id` | Process a subscription (alternative format) | Yes |

### Subscription Status and Sharing

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/subscriptions/:id/status` | Gets processing status of a subscription | Yes |
| POST | `/subscriptions/:id/share` | Shares a subscription with another user | Yes |
| DELETE | `/subscriptions/:id/share` | Removes subscription sharing | Yes |

### Subscription Types

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/subscriptions/types` | Lists all available subscription types | Optional |
| POST | `/subscriptions/types` | Creates a new subscription type | Yes |

## User Endpoints

```
GET /me → Get profile
  ↓
PATCH /me → Update profile
  ↓
PATCH /me/notification-settings → Update settings
  ↓
GET /me/email-preferences → View email settings
```

### User Profile Management

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/me` | Retrieves the current user's profile information | Yes |
| PATCH | `/me` | Updates the current user's profile information | Yes |
| PATCH | `/me/notification-settings` | Updates notification settings for the current user | Yes |
| GET | `/me/email-preferences` | Retrieves email notification preferences | Yes |
| PATCH | `/me/email-preferences` | Updates email notification preferences | Yes |
| POST | `/me/test-email` | Sends a test email to verify notification setup | Yes |
| POST | `/notifications/mark-sent` | Administrative endpoint to mark notifications as sent via email | Yes |

## Template Endpoints

```
GET /templates → List templates
  ↓
GET /templates/:id → View template
  ↓
POST /templates → Create template
  ↓
POST /templates/:id/subscribe → Subscribe to template
```

### Template Management

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/templates` | Lists available templates with pagination | No |
| GET | `/templates/:id` | Gets details for a specific template | No |
| POST | `/templates` | Creates a new template | Yes |
| POST | `/templates/:id/subscribe` | Creates a subscription from a template | Yes |

## API Explorer Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/health` | Health check and API overview | No |
| GET | `/explorer` | Lists all available endpoints | No |
| GET | `/explorer/:path` | Get documentation for a specific endpoint | No |

## Diagnostics Endpoints

⚠️ **Note**: These endpoints are intended for development/staging environments only.

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/debug/notification/:id` | Trace a notification's journey | No |
| GET | `/debug/subscription/:id` | Trace a subscription's journey | No |
| GET | `/debug/health` | Check system health | No |
| POST | `/debug/notification/:id/resend` | Re-send a notification in real-time | No |
| GET | `/notifications/:userId` | Test endpoint to diagnose notification retrieval issues | No |
| POST | `/notifications/create-test` | Creates a test notification | No |
| GET | `/health` | Basic health check for the API | No |
| GET | `/user-exists/:userId` | Checks if a user exists in the database | No |
| POST | `/create-user` | Creates a test user record | No |
| GET | `/db-info` | Gets database schema information | Yes |
| GET | `/db-status` | Gets database connection status | No |
| GET | `/db-tables` | Lists database tables | No |

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

### Example Error and Correction

#### Invalid Request Example

Request:
```http
POST /api/v1/subscriptions
Authorization: BearereyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "My Subscription"
}
```

Error Response:
```json
{
  "error": {
    "code": "MISSING_HEADERS",
    "message": "Authentication headers are missing or malformed",
    "request_id": "req-123456",
    "timestamp": "2025-03-15T12:34:56Z",
    "help": {
      "endpoint_info": {
        "description": "Create a new subscription",
        "auth_required": true,
        "method": "POST"
      },
      "documentation_url": "https://docs.nifya.app/api/subscriptions",
      "correct_format": "Authorization: Bearer {token} (note the space after Bearer)"
    }
  }
}
```

#### Corrected Request

```http
POST /api/v1/subscriptions
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-User-ID: 65c6074d-dbc4-4091-8e45-b6aecffd9ab9
Content-Type: application/json

{
  "name": "My Subscription",
  "type": "boe",
  "prompts": ["Search term 1"]
}
```

## Endpoint-Specific Error Handling

### Subscription Endpoints Errors

#### Creating a Subscription

Common errors when creating a subscription:

| Error | Description | Solution |
|-------|-------------|----------|
| INVALID_SUBSCRIPTION_TYPE | The provided subscription type does not exist | Use one of the available types from GET `/subscriptions/types` |
| MISSING_PROMPTS | No search prompts provided | Add at least one prompt to the "prompts" array |
| TOO_MANY_PROMPTS | Too many search prompts provided | Limit prompts to a maximum of 3 |
| INVALID_CONFIGURATION | Invalid configuration parameters | Check the configuration object structure for the specific subscription type |

Example correct subscription creation:

```json
{
  "name": "My BOE Subscription",
  "type": "boe",
  "prompts": ["Ayuntamiento Barcelona", "licitaciones"],
  "frequency": "daily",
  "configuration": {
    "sections": ["all"]
  }
}
```

#### Processing a Subscription

Common errors when processing a subscription:

| Error | Description | Solution |
|-------|-------------|----------|
| SUBSCRIPTION_NOT_FOUND | Subscription ID doesn't exist | Verify the subscription ID |
| NOT_SUBSCRIPTION_OWNER | User doesn't own the subscription | Ensure you're using the correct user account |
| PROCESSOR_UNAVAILABLE | The processor service is unavailable | Try again later |
| ALREADY_PROCESSING | Subscription is already being processed | Wait for current processing to complete |

### Notification Endpoints Errors

Common errors when working with notifications:

| Error | Description | Solution |
|-------|-------------|----------|
| NOTIFICATION_NOT_FOUND | Notification ID doesn't exist | Verify the notification ID |
| NOT_NOTIFICATION_OWNER | User doesn't own the notification | Ensure you're using the correct user account |
| INVALID_PAGINATION | Invalid pagination parameters | Check limit and page/offset values |
| INVALID_FILTER | Invalid filter parameters | Verify filter parameter values |

### User Endpoints Errors

Common errors when updating user information:

| Error | Description | Solution |
|-------|-------------|----------|
| USER_NOT_FOUND | User doesn't exist in the database | Create user record via Authentication Service first |
| INVALID_EMAIL_PREFERENCES | Invalid email preference settings | Check available preference options |
| EMAIL_DELIVERY_FAILED | Test email failed to deliver | Verify email address or check email service status |