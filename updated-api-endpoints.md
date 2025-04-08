# NIFYA Backend API Endpoints (Updated)

This document lists all available backend API endpoints organized by their URL prefix. It includes both documented endpoints and additional endpoints required by the frontend application.

## Root Endpoints

These endpoints are available at the root level with no prefix:

- `GET /health` - Health check and system status
- `GET /version` - API version and build information

## Diagnostics Endpoints

Diagnostic endpoints are available under the `/diagnostics` prefix:

- `GET /diagnostics/notifications/:userId` - Test notification retrieval for a specific user
- `POST /diagnostics/notifications/create-test` - Create a test notification
- `GET /diagnostics/subscription-debug/:userId` - Debug subscription retrieval for a specific user
- `GET /diagnostics/user-exists/:userId` - Check if a user exists in the database
- `POST /diagnostics/create-user` - Create a test user
- `GET /diagnostics/subscription-test/*` - Various subscription testing endpoints

## Authentication Endpoints (v1)

Authentication endpoints are available under the `/api/v1/auth` prefix:

- `POST /api/v1/auth/refresh` - Refresh an expired access token

## User API Endpoints (v1)

User-related endpoints are available under the `/api/v1/users` prefix:

- `GET /api/v1/users/me` - Get the current user's profile
- `PUT /api/v1/users/me` - Update the current user's profile
- `GET /api/v1/users/preferences` - Get user preferences
- `PUT /api/v1/users/preferences` - Update user preferences

## Subscription API Endpoints (v1)

Subscription-related endpoints are available under the `/api/v1/subscriptions` prefix:

### Core CRUD Operations
- `GET /api/v1/subscriptions` - List user subscriptions (with filtering)
- `POST /api/v1/subscriptions` - Create a new subscription
- `GET /api/v1/subscriptions/:id` - Get a specific subscription by ID
- `PUT /api/v1/subscriptions/:id` - Update a subscription
- `DELETE /api/v1/subscriptions/:id` - Delete a subscription
- `DELETE /api/v1/subscriptions/` - Delete all user subscriptions

### Subscription Status Management
- `PATCH /api/v1/subscriptions/:id/activate` - Activate a subscription
- `PATCH /api/v1/subscriptions/:id/deactivate` - Deactivate a subscription
- `PATCH /api/v1/subscriptions/:id/toggle` - Toggle subscription active status (legacy)

### Subscription Processing
- `POST /api/v1/subscriptions/:id/process` - Process a subscription immediately
- `GET /api/v1/subscriptions/:id/status` - Get subscription processing status

### Statistics and Analysis
- `GET /api/v1/subscriptions/stats` - Get subscription statistics
- `GET /api/v1/subscriptions/debug-filter` - Debug endpoint for subscription filters

### Sharing
- `POST /api/v1/subscriptions/:id/share` - Share a subscription with another user

### Subscription Types
- `GET /api/v1/subscriptions/types` - List all subscription types
- `POST /api/v1/subscriptions/types` - Create a new subscription type
- `GET /api/v1/subscriptions/types/:id` - Get a specific subscription type

## Notification API Endpoints (v1)

Notification-related endpoints are available under the `/api/v1/notifications` prefix:

### Core CRUD Operations
- `GET /api/v1/notifications` - List user notifications (with filtering)
- `GET /api/v1/notifications/:id` - Get a specific notification
- `DELETE /api/v1/notifications/:id` - Delete a notification
- `DELETE /api/v1/notifications/delete-all` - Delete all notifications

### Notification Status Management
- `PATCH /api/v1/notifications/:id/read` - Mark a notification as read
- `PATCH /api/v1/notifications/read-all` - Mark all notifications as read

### Statistics and Analytics
- `GET /api/v1/notifications/stats` - Get notification statistics
- `GET /api/v1/notifications/activity` - Get notification activity data

### Related Notifications
- `GET /api/v1/subscriptions/:id/notifications` - Get notifications for a specific subscription

## Template API Endpoints (v1)

Template-related endpoints are available under the `/api/v1/templates` prefix:

- `GET /api/v1/templates` - List available subscription templates
- `GET /api/v1/templates/public` - List public subscription templates
- `GET /api/v1/templates/:id` - Get a specific template
- `POST /api/v1/templates` - Create a new template

## Legacy/Alternative Endpoints

These endpoints are maintained for backward compatibility but should be migrated to their standard form:

- `POST /api/v1/subscriptions/process/:id` - Alternative format for processing a subscription
- `GET /api/v1/subscription-processing/:id` - Alternative endpoint for checking processing status

---

## Note on Route Standardization

This endpoint documentation has been updated to reflect both the standardized routing system and additional endpoints required by the frontend application. All primary API endpoints follow the `/api/v1/{resource}` pattern.

Frontend applications should use these documented endpoints for all API requests. 