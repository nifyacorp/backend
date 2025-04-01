# Schema Compatibility Analysis

This document analyzes the compatibility between the proposed single schema design and the current database operations in the NIFYA service.

## Identified Schema Discrepancies

### 1. `notifications` Table

#### Schema Definition:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  read BOOLEAN DEFAULT false,
  entity_type VARCHAR(255) DEFAULT 'notification:generic',
  source VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false
);
```

#### Code Usage:
The notification-worker service (`createNotification` function) uses:
- `subscription_id` - Missing in schema
- `source_url` - Missing in schema
- `email_sent_at` - Missing in schema
- `read_at` - Missing in schema

Also, the email notification service queries with:
- `LEFT JOIN subscriptions s ON s.id = n.subscription_id` - Requires `subscription_id` column

### 2. `users` Table

#### Schema Definition:
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Code Usage:
The user email preferences repository and notification services query:
- `email_notifications` - Missing in schema
- `notification_email` - Missing in schema
- `digest_time` - Missing in schema
- `notification_settings` - Missing in schema
- `email_verified` - Missing in schema
- `name` - Missing in schema

The code is mixing between direct columns and JSONB `notification_settings`.

### 3. `user_email_preferences` vs. User Columns

The schema has a separate `user_email_preferences` table, but the code often looks for preferences directly in the `users` table. There's inconsistency in the data model approach.

## Service-Specific Issues

### 1. Notification Worker Service

The notification worker creates notifications with:
```javascript
INSERT INTO notifications (
  user_id, subscription_id, title, content, source_url, metadata, entity_type, created_at
)
```

This requires the `subscription_id` and `source_url` columns that aren't in the schema.

### 2. Email Notification Service

Queries users with:
```javascript
SELECT
  u.id, u.email, u.name,
  u.notification_settings->>'language' as language,
  u.notification_settings->>'emailNotifications' as "emailNotifications",
  u.notification_settings->>'notificationEmail' as "notificationEmail",
  u.notification_settings->>'emailFrequency' as "emailFrequency"
FROM users u
```

This requires a JSONB `notification_settings` column that's missing in the schema.

### 3. Backend Core Service

The backend assumes:
- `read_at` column in notifications
- `email_sent_at` column in notifications

## Recommended Schema Adjustments

Based on the analysis, here are the recommended updates to the `complete-schema.sql` file:

### 1. Update `notifications` Table

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  source_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  entity_type VARCHAR(255) DEFAULT 'notification:generic',
  source VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE
);
```

### 2. Update `users` Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  email_verified BOOLEAN DEFAULT false,
  notification_settings JSONB DEFAULT '{
    "emailNotifications": true,
    "notificationEmail": null,
    "emailFrequency": "daily",
    "instantNotifications": false,
    "language": "es"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Decision on Email Preferences

You have two options:

1. **Option A**: Use a separate `user_email_preferences` table as in the schema
2. **Option B**: Remove the separate table and solely use the JSONB column in the `users` table

Based on the code analysis, it appears most services use the second approach, so consider removing the separate table unless you have specific reasons to keep it.

## Conclusion

The current schema in `complete-schema.sql` doesn't fully match the database operations across all services. Updating the schema as suggested above will ensure compatibility with the entire system.

After implementing these changes, I recommend:

1. Updating any services that use inconsistent column names
2. Adding proper database migrations to modify existing tables
3. Adding appropriate indexes for the new columns like `subscription_id` in the notifications table

These modifications will ensure your single schema approach works correctly with all existing services.