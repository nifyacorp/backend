# NIFYA Database Schema Reference

This document provides a comprehensive reference for the NIFYA database schema, including tables, relationships, and access patterns. Use this as a guide when interacting with the database from any service.

## Database Structure

The NIFYA system uses a PostgreSQL database with Row Level Security (RLS) enabled. The primary entities include:

- **Users**: Application users
- **Subscription Types**: Available types of subscriptions (BOE, DOGA, etc.)
- **Subscriptions**: User-created subscriptions to specific data sources
- **Notifications**: Alerts generated for subscription matches
- **Email Preferences**: User configuration for email notifications

## Table Schema

### users

**Description**: Stores user account information and preferences.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| email | VARCHAR(255) | No | | Unique email address |
| display_name | VARCHAR(255) | Yes | | User's display name |
| first_name | VARCHAR(255) | Yes | | User's first name |
| last_name | VARCHAR(255) | Yes | | User's last name |
| avatar_url | TEXT | Yes | | Profile image URL |
| role | VARCHAR(50) | Yes | 'user' | User role ('user', 'admin') |
| created_at | TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last update timestamp |
| metadata | JSONB | Yes | '{}' | Additional metadata |
| notification_settings | JSONB | Yes | *default JSON* | Notification delivery preferences |
| email_verified | BOOLEAN | Yes | false | Whether email is verified |
| name | VARCHAR(255) | Yes | | Legacy name field |

**Indexes**:
- PRIMARY KEY on (id)
- UNIQUE INDEX on (email)
- INDEX on (email_verified)
- INDEX on (role)

**RLS Policy**: Users can only access their own records via the user_id match.

### subscription_types

**Description**: Defines the available subscription types in the system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR(255) | No | | Primary key |
| name | VARCHAR(255) | No | | Type name (e.g., "boe") |
| display_name | VARCHAR(255) | No | | Human-readable name (e.g., "BOE") |
| icon | VARCHAR(50) | Yes | | Icon identifier for UI |
| created_at | TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last update timestamp |
| metadata | JSONB | Yes | '{}' | Additional metadata |
| is_system | BOOLEAN | Yes | TRUE | Whether this is a built-in type |

**Indexes**:
- PRIMARY KEY on (id)

**Default Types**:
- 'boe': Boletín Oficial del Estado
- 'doga': Diario Oficial de Galicia
- 'real-estate': Real Estate listings

### subscriptions

**Description**: User subscriptions with specific search parameters.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| name | VARCHAR(255) | No | | Subscription name |
| description | TEXT | Yes | | User-defined description |
| user_id | UUID | No | | Foreign key to users(id) |
| type_id | VARCHAR(255) | No | | Foreign key to subscription_types(id) |
| prompts | JSONB | Yes | '[]' | Array of search keywords |
| frequency | VARCHAR(50) | No | | Update frequency ('immediate', 'daily') |
| active | BOOLEAN | Yes | TRUE | Whether subscription is active |
| created_at | TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last update timestamp |
| metadata | JSONB | Yes | '{}' | Additional metadata |

**Indexes**:
- PRIMARY KEY on (id)
- INDEX on (user_id)
- INDEX on (type_id)
- INDEX on (active)

**Foreign Keys**:
- user_id REFERENCES users(id) ON DELETE CASCADE
- type_id REFERENCES subscription_types(id)

**RLS Policy**: Users can only access their own subscriptions via the user_id match.

### notifications

**Description**: Notifications generated for user subscriptions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| user_id | UUID | No | | Foreign key to users(id) |
| title | VARCHAR(255) | No | | Notification title |
| content | TEXT | Yes | | Notification content |
| read | BOOLEAN | Yes | FALSE | Whether notification has been read |
| entity_type | VARCHAR(255) | Yes | 'notification:generic' | Type of entity referenced |
| source | VARCHAR(50) | Yes | | Source system identifier |
| data | JSONB | Yes | '{}' | Structured data for notification |
| metadata | JSONB | Yes | '{}' | Additional metadata |
| created_at | TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last update timestamp |
| email_sent | BOOLEAN | Yes | FALSE | Whether email notification was sent |
| email_sent_at | TIMESTAMPTZ | Yes | | When email notification was sent |
| read_at | TIMESTAMPTZ | Yes | | When notification was marked as read |
| source_url | TEXT | Yes | | URL to the source document/page |
| subscription_id | UUID | Yes | | Foreign key to subscriptions(id) |

**Indexes**:
- PRIMARY KEY on (id)
- INDEX on (user_id)
- INDEX on (read)
- INDEX on (entity_type)
- INDEX on (created_at)
- INDEX on (subscription_id)
- INDEX on (email_sent)

**Foreign Keys**:
- user_id REFERENCES users(id) ON DELETE CASCADE
- subscription_id REFERENCES subscriptions(id) ON DELETE SET NULL

**RLS Policy**: Users can only access their own notifications via the user_id match.

### user_email_preferences

**Description**: User preferences for email notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| user_id | UUID | No | | Foreign key to users(id) |
| subscription_type | VARCHAR(255) | Yes | | Foreign key to subscription_types(id) |
| frequency | VARCHAR(50) | Yes | 'immediate' | Frequency ('immediate', 'daily', etc.) |
| enabled | BOOLEAN | Yes | TRUE | Whether email notifications are enabled |
| created_at | TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on (id)
- UNIQUE on (user_id, subscription_type)
- INDEX on (user_id)

**Foreign Keys**:
- user_id REFERENCES users(id) ON DELETE CASCADE
- subscription_type REFERENCES subscription_types(id)

**RLS Policy**: Users can only access their own email preferences via the user_id match.

### schema_version

**Description**: Tracks database schema migrations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| version | VARCHAR(255) | No | | Primary key - migration version |
| applied_at | TIMESTAMPTZ | Yes | NOW() | When migration was applied |
| description | TEXT | Yes | | Description of migration |

**Indexes**:
- PRIMARY KEY on (version)

## Row Level Security (RLS)

The database uses Row Level Security to ensure data isolation between users. To access user data, applications must:

1. **Set the user context** before executing queries:
   ```sql
   SET LOCAL app.current_user_id = '<user_id>';
   ```

2. **Use the correct role** for the connection (app_user for regular users, app_service for background jobs)

## Common Query Patterns

### Fetch user's subscriptions

```sql
-- Get subscriptions for the current user
SELECT s.id, s.name, s.type_id, s.prompts, s.frequency, s.active, s.created_at
FROM subscriptions s
WHERE s.user_id = current_user_id()
ORDER BY s.created_at DESC;
```

### Fetch user's notifications

```sql
-- Get recent unread notifications for the current user
SELECT n.id, n.title, n.content, n.created_at, n.entity_type, 
       n.source, n.subscription_id, n.source_url
FROM notifications n
WHERE n.user_id = current_user_id() 
  AND n.read = FALSE
ORDER BY n.created_at DESC
LIMIT 10;
```

### Set notification as read

```sql
-- Mark notification as read
UPDATE notifications
SET read = TRUE, 
    read_at = NOW(),
    updated_at = NOW()
WHERE id = '<notification_id>' 
  AND user_id = current_user_id();
```

### Check email notification preferences

```sql
-- Get email preferences for a subscription type
SELECT ep.frequency, ep.enabled
FROM user_email_preferences ep
WHERE ep.user_id = current_user_id()
  AND ep.subscription_type = '<subscription_type_id>';
```

## JSONB Column Structures

### users.notification_settings

```json
{
  "emailNotifications": true,
  "notificationEmail": "user@example.com",
  "emailFrequency": "daily",
  "instantNotifications": false,
  "language": "es"
}
```

### subscriptions.prompts

```json
[
  "keyword1",
  "keyword2",
  "keyword3"
]
```

### notifications.data

```json
{
  "matchScore": 0.85,
  "matchDetails": {
    "matchedTerms": ["keyword1", "keyword2"],
    "context": "Surrounding text where match was found"
  },
  "documentDetails": {
    "publicationDate": "2025-04-01",
    "documentId": "BOE-A-2025-12345"
  }
}
```

## Best Practices

1. **Always set RLS context** before querying user data:
   ```js
   await setRLSContext(userId);
   const result = await query('SELECT * FROM subscriptions');
   ```

2. **Use parameterized queries** to prevent SQL injection:
   ```js
   await query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
   ```

3. **Use transactions** for multi-step operations:
   ```js
   await query('BEGIN');
   // Multiple operations...
   await query('COMMIT');
   ```

4. **Check column existence** before accessing newly added columns, especially in older services

5. **Validate JSONB data** before storing it in the database to ensure it matches expected schema

## Schema Evolution

The database schema is maintained using an enhanced startup migration system that ensures all tables, columns, and dependencies are properly created. When adding new features:

1. Update the startup-migration.js file to include the new schema elements
2. Document new columns or tables in this reference
3. Verify compatibility with existing services