# Row-Level Security (RLS) Context Fixes

## Problem

Notifications were not appearing in the user dashboard despite being successfully created in the database. The issue was that the backend was not setting the Row-Level Security (RLS) context when querying notifications, causing PostgreSQL's RLS policies to block access to the notifications.

## Solution

1. Added `setRLSContext` and `withRLSContext` functions to the database client:
   - `setRLSContext`: Sets the RLS context for the current database session
   - `withRLSContext`: Executes a callback function with the RLS context set for a specific user

2. Updated all notification repository functions to set the RLS context before executing database queries:
   - `getUserNotifications`: Retrieves notifications for a user
   - `getNotificationCount`: Counts notifications for a user
   - `markNotificationAsRead`: Marks a notification as read
   - `markAllNotificationsAsRead`: Marks all notifications as read
   - `deleteNotification`: Deletes a notification
   - `deleteAllNotifications`: Deletes all notifications for a user

## Implementation Details

The RLS context is set by executing the following SQL command:
```sql
SET LOCAL app.current_user_id = $1
```

This sets the PostgreSQL session variable `app.current_user_id` to the user's ID, which is then used by RLS policies to determine if the user has access to the requested rows.

## Testing

To verify the fix:
1. Log in to the application
2. Navigate to the notifications page
3. Verify that notifications are displayed correctly
4. Test marking notifications as read and deleting notifications

## Additional Notes

The diagnostics routes were already setting the RLS context correctly, which is why they were able to retrieve notifications. This fix ensures that all notification-related operations set the RLS context consistently. 