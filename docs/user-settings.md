# User Settings & Preferences Implementation

## Overview

This document details the implementation of user settings and preferences in the NIFYA platform. Instead of creating separate tables for each setting type, we use a flexible JSONB structure in the user table to store all preferences and settings.

## Database Structure

All user settings are stored in the `users.metadata` JSONB field, organized in a structured hierarchy:

```json
{
  "profile": {
    "bio": "Text about the user (500 chars max)",
    "interests": []
  },
  "preferences": {
    "language": "es", 
    "theme": "light"
  },
  "notifications": {
    "email": {
      "enabled": true,
      "useCustomEmail": false,
      "customEmail": null,
      "digestTime": "08:00"
    }
  },
  "security": {
    "lastPasswordChange": "2023-05-15T10:30:00Z",
    "lastLogoutAllDevices": null
  }
}
```

### Sections Detail

#### Profile Information
- **Bio**: User self-description (max 500 characters)
- **Interests**: Array of topics/interests (for future recommendation features)

#### Application Preferences
- **Language**: UI language code (default: "es")
- **Theme**: UI theme setting (light/dark)

#### Notification Settings
- **Email Enabled**: Master switch for all email notifications
- **Use Custom Email**: Whether to send to an alternate email
- **Custom Email**: Alternative email address
- **Digest Time**: Time for sending daily digest (format: "HH:MM")

#### Security Settings
- **Last Password Change**: Timestamp of the last password change
- **Last Logout All Devices**: Timestamp of last global logout

## Frontend Integration

The frontend `/settings` route accesses and modifies these settings through dedicated API endpoints.

### API Integration Points

| Setting Section | Frontend Tab | API Endpoints |
|-----------------|--------------|--------------|
| Profile | "Perfil" | GET/PATCH `/api/v1/users/me` |
| Email Notifications | "Email Notifications" | GET/PATCH `/api/v1/users/me/email-preferences` |
| Language | "Preferencias" | GET/PATCH `/api/v1/users/me/preferences` |
| Security | "Seguridad" | GET/PATCH `/api/v1/users/me/security` |

## Database Operations

### Reading Settings

To access user settings, the backend can use PostgreSQL's JSON operators:

```sql
-- Get all user settings
SELECT metadata FROM users WHERE id = $1;

-- Get specific section
SELECT metadata->'profile' FROM users WHERE id = $1;

-- Get specific setting
SELECT metadata->'preferences'->>'language' FROM users WHERE id = $1;
```

### Updating Settings

To update settings, use the `jsonb_set` function:

```sql
-- Update entire profile section
UPDATE users
SET metadata = jsonb_set(metadata, '{profile}', $1::jsonb),
    updated_at = NOW()
WHERE id = $2
RETURNING *;

-- Update single setting
UPDATE users
SET metadata = jsonb_set(
      metadata, 
      '{notifications,email,enabled}', 
      $1::jsonb
    ),
    updated_at = NOW()
WHERE id = $2
RETURNING *;
```

## Implementation Examples

### User Service

```javascript
// User service for managing user settings
const userService = {
  // Get user profile with all settings
  async getUserProfile(userId) {
    const { rows } = await db.query(
      'SELECT id, email, display_name, first_name, last_name, avatar_url, metadata FROM users WHERE id = $1',
      [userId]
    );
    return rows[0] || null;
  },
  
  // Update user profile information
  async updateUserProfile(userId, profileData) {
    const { bio } = profileData;
    
    // Validate bio length
    if (bio && bio.length > 500) {
      throw new AppError('VALIDATION_ERROR', 'Bio cannot exceed 500 characters', 400);
    }
    
    return await db.query(
      `UPDATE users 
       SET metadata = jsonb_set(metadata, '{profile}', $1::jsonb),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({ bio }), userId]
    );
  },
  
  // Get user email preferences
  async getEmailPreferences(userId) {
    const { rows } = await db.query(
      `SELECT metadata->'notifications'->'email' as email_preferences
       FROM users
       WHERE id = $1`,
      [userId]
    );
    
    return rows[0]?.email_preferences || {};
  },
  
  // Update email preferences
  async updateEmailPreferences(userId, preferences) {
    const { enabled, useCustomEmail, customEmail, digestTime } = preferences;
    
    // Validate email if present
    if (useCustomEmail && customEmail) {
      // Email validation logic
    }
    
    return await db.query(
      `UPDATE users 
       SET metadata = jsonb_set(metadata, '{notifications,email}', $1::jsonb),
           updated_at = NOW()
       WHERE id = $2
       RETURNING metadata->'notifications'->'email' as email_preferences`,
      [JSON.stringify({ enabled, useCustomEmail, customEmail, digestTime }), userId]
    );
  }
};
```

### HTTP Routes

```javascript
// User settings routes
router.get('/me', async (req, res) => {
  const userId = req.user.id;
  const profile = await userService.getUserProfile(userId);
  res.json(profile);
});

router.patch('/me', async (req, res) => {
  const userId = req.user.id;
  const updatedProfile = await userService.updateUserProfile(userId, req.body);
  res.json(updatedProfile);
});

router.get('/me/email-preferences', async (req, res) => {
  const userId = req.user.id;
  const preferences = await userService.getEmailPreferences(userId);
  res.json(preferences);
});

router.patch('/me/email-preferences', async (req, res) => {
  const userId = req.user.id;
  const updatedPreferences = await userService.updateEmailPreferences(userId, req.body);
  res.json(updatedPreferences);
});
```

## Benefits of This Approach

1. **Flexibility**: Adding new settings doesn't require schema changes
2. **Performance**: All settings retrieved in a single query
3. **Organization**: Logically structured data
4. **Default Values**: Schema provides sensible defaults
5. **Validation**: Structured JSON validation can be applied

## Future Considerations

1. **Caching**: Consider caching frequently accessed settings
2. **Migration**: Plan for future migrations if settings structure changes
3. **Analytics**: Track settings usage for UX improvements
4. **Sync**: Ensure real-time sync across devices 