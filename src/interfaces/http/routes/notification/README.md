# Notification Routes

This directory contains the notification API routes for the NIFYA platform. The notification system enables users to receive and manage notifications about their subscriptions and other system events.

## Directory Structure

- `index.js` - Main entry point that registers all notification route modules
- `crud.routes.js` - CRUD operations for notifications (get, delete)
- `status.routes.js` - Routes for managing notification read status
- `stats.routes.js` - Routes for notification statistics and analytics
- `realtime.routes.js` - Routes for real-time WebSocket notification delivery

## Database Schema

Notifications are stored in the `notifications` table with the following structure:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  source_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  entity_type VARCHAR(255) DEFAULT 'notification:generic',
  source VARCHAR(50),
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE
);
```

## API Endpoints

All routes are mounted under `/api/v1/notifications` in the main application.

### CRUD Operations

- `GET /` - Get notifications for authenticated user
- `GET /:notificationId` - Get notification details
- `GET /by-entity` - Get notifications by entity type
- `DELETE /:notificationId` - Delete a notification
- `DELETE /delete-all` - Delete all notifications

### Status Management

- `POST /:notificationId/read` - Mark notification as read
- `POST /:notificationId/unread` - Mark notification as unread
- `POST /read-all` - Mark all notifications as read
- `POST /unread-all` - Mark all notifications as unread

### Statistics

- `GET /stats` - Get notification statistics
- `GET /activity` - Get notification activity statistics
- `GET /summary` - Get notification summary statistics

### Realtime

- `POST /realtime` - Send realtime notification via WebSocket
- `POST /broadcast` - Broadcast a notification to multiple users

## Full URL Examples

- `https://backend-415554190254.us-central1.run.app/api/v1/notifications` - Get all notifications
- `https://backend-415554190254.us-central1.run.app/api/v1/notifications/{notification-id}` - Get a specific notification
- `https://backend-415554190254.us-central1.run.app/api/v1/notifications/stats` - Get notification statistics

## WebSocket Integration

Notifications can be delivered in real-time through WebSocket connections. The socket manager handles connection management and message delivery:

```javascript
// Send a notification to a specific user
socketManager.sendToUser(userId, 'notification', notificationData);
```

## Related Components

- Notification Controller - Implements the business logic for notification operations
- Notification Worker - Processes notifications and publishes them for delivery
- Email Notification Service - Sends email notifications based on user preferences 