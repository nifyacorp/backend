# User Profile Routes Fix

## Issues Fixed

This update addresses several issues related to the user profile endpoints:

### 1. Profile Update Endpoint (HIGH)
- **Issue**: PATCH `/api/v1/me` endpoint returned 404
- **Impact**: Users couldn't update their profile information
- **Fix**: 
  - Added direct implementation of the profile update endpoint at `/api/v1/me`
  - Ensured proper validation for profile update fields
  - Used the existing user service to maintain data consistency

### 2. Notification Settings Update Endpoint (MEDIUM)
- **Issue**: PATCH `/api/v1/me/notification-settings` returned 404
- **Impact**: Users couldn't update their notification preferences
- **Fix**: 
  - Added direct implementation of the notification settings update endpoint at `/api/v1/me/notification-settings`
  - Implemented the missing `updateNotificationSettings` method in the user service
  - Added proper validation for notification settings
  - Ensured settings are correctly saved to the user record

## Implementation Details

### 1. Added `updateNotificationSettings` Method to User Service

The `userService.js` file was updated to include a new method for handling notification settings updates. This method:
- Validates the notification settings (e.g., ensuring `emailFrequency` is valid)
- Updates the user's metadata in the database with the new settings
- Returns the updated notification settings

```javascript
async updateNotificationSettings(userId, settings, context) {
  logRequest(context, 'Updating notification settings', { 
    userId,
    updateFields: Object.keys(settings)
  });

  try {
    // Validate settings
    if (settings.emailFrequency && settings.emailFrequency !== 'daily') {
      throw new AppError(
        'INVALID_EMAIL_FREQUENCY',
        'Invalid email frequency. Supported values: daily',
        400,
        { allowedFrequencies: ['daily'] }
      );
    }

    // Prepare updates object for metadata
    const updates = {};
    if (settings.emailNotifications !== undefined) {
      updates.emailNotifications = settings.emailNotifications;
    }
    if (settings.notificationEmail !== undefined) {
      updates.notificationEmail = settings.notificationEmail;
    }
    if (settings.emailFrequency !== undefined) {
      updates.emailFrequency = settings.emailFrequency;
    }
    if (settings.instantNotifications !== undefined) {
      updates.instantNotifications = settings.instantNotifications;
    }

    // Update the user metadata
    const result = await query(
      `UPDATE users 
       SET 
         metadata = metadata || $1::jsonb,
         updated_at = NOW()
       WHERE id = $2
       RETURNING 
         metadata->>'emailNotifications' as "emailNotifications",
         metadata->>'notificationEmail' as "notificationEmail",
         metadata->>'emailFrequency' as "emailFrequency",
         metadata->>'instantNotifications' as "instantNotifications"`,
      [
        JSON.stringify(updates),
        userId
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError(
        USER_ERRORS.NOT_FOUND.code,
        USER_ERRORS.NOT_FOUND.message,
        404,
        { userId }
      );
    }

    // Convert string booleans to actual booleans
    const notificationSettings = result.rows[0];
    notificationSettings.emailNotifications = notificationSettings.emailNotifications === 'true';
    notificationSettings.instantNotifications = notificationSettings.instantNotifications === 'true';

    return notificationSettings;
  } catch (error) {
    // Error handling...
  }
}
```

### 2. Updated Route Handlers in `index.js`

The main application file was updated to add direct handlers for the user profile and notification settings endpoints at the expected paths:

```javascript
// Add direct handler for user profile endpoints
fastify.patch('/api/v1/me', {
  schema: {
    // Schema definition...
  }
}, async (request, reply) => {
  const { userService } = await import('./core/user/user.service.js');
  // Implementation...
});

// Add direct handler for notification settings
fastify.patch('/api/v1/me/notification-settings', {
  schema: {
    // Schema definition...
  }
}, async (request, reply) => {
  const { userService } = await import('./core/user/user.service.js');
  // Implementation...
});
```

## Testing Strategy

These changes have been tested by:

1. Manually verifying that the PATCH `/api/v1/me` endpoint correctly updates user profiles
2. Manually verifying that the PATCH `/api/v1/me/notification-settings` endpoint correctly updates notification settings
3. Ensuring there are no regressions in existing functionality
4. Confirming that the response format matches the expected schema

## Next Steps

1. Add additional tests to ensure robustness of these endpoints
2. Consider refactoring the user routes to use a more consistent organization
3. Update API documentation to reflect these changes