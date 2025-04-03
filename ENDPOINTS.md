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
- `Authorization: Bearer <token>` header
- `X-User-ID: <user-id>` header

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