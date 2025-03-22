# NIFYA Database Schema Documentation

## Overview

NIFYA uses a PostgreSQL database with a comprehensive schema designed for managing user subscriptions and notifications. The database follows a clean domain-driven design with proper relationships between entities and Row Level Security (RLS) for user data isolation.

## Schema Diagram

```
┌───────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│     users         │       │  subscription_types   │       │  subscription_      │
├───────────────────┤       ├──────────────────────┤       │  templates          │
│ id (PK)           │       │ id (PK)              │       ├─────────────────────┤
│ email             │       │ name                 │       │ id (PK)             │
│ name              │       │ description          │       │ type                │
│ preferences       │       │ icon                 │       │ name                │
│ notification_     │       │ logo                 │       │ description         │
│ settings          │       │ is_system            │       │ prompts             │
│ created_at        │◄──┐   │ created_by (FK)      │───────│ default_settings    │
│ updated_at        │   │   │ created_at           │       │ created_by (FK)     │
└───────────────────┘   │   │ updated_at           │       │ is_public           │
        ▲               │   └──────────────────────┘       │ frequency           │
        │               │             ▲                    │ icon                │
        │               │             │                    │ logo                │
        │               │             │                    │ metadata            │
┌───────────────────┐   │   ┌──────────────────────┐       │ created_at          │
│  activity_logs    │   │   │    subscriptions     │       └─────────────────────┘
├───────────────────┤   │   ├──────────────────────┤                ▲
│ id (PK)           │   │   │ id (PK)              │                │
│ user_id (FK)      │───┘   │ user_id (FK)         │────┐           │
│ action            │       │ type_id (FK)         │────┘           │
│ details           │       │ name                 │                │
│ created_at        │       │ description          │                │
└───────────────────┘       │ logo                 │                │
                            │ prompts              │                │
                            │ frequency            │                │
                            │ active               │                │
                            │ settings             │                │
                            │ last_check_at        │                │
                            │ created_at           │                │
                            │ updated_at           │                │
                            └──────────────────────┘                │
                                      ▲                             │
                                      │                             │
                                      │                             │
┌───────────────────┐       ┌──────────────────────┐                │
│    feedback       │       │    notifications     │                │
├───────────────────┤       ├──────────────────────┤                │
│ id (PK)           │       │ id (PK)              │                │
│ user_id (FK)      │───┐   │ user_id (FK)         │────┐           │
│ notification_id   │───┘   │ subscription_id (FK) │────┘           │
│ subscription_id   │───────│ title                │                │
│ type              │       │ content              │                │
│ comment           │       │ source_url           │                │
│ created_at        │       │ metadata             │                │
└───────────────────┘       │ read                 │                │
                            │ read_at              │                │
                            │ email_sent           │                │
                            │ email_sent_at        │                │
                            │ created_at           │                │
                            └──────────────────────┘                │
                                                                    │
┌───────────────────────────────────┐                               │
│    subscription_processing        │                               │
├───────────────────────────────────┤                               │
│ id (PK)                           │                               │
│ subscription_id (FK)              │───────────────────────────────┘
│ last_run_at                       │
│ next_run_at                       │
│ status                            │
│ error                             │
│ metadata                          │
│ created_at                        │
│ updated_at                        │
└───────────────────────────────────┘
```

## Tables

### users

Stores user account information and preferences.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| email | text | Unique email address |
| name | text | User's full name |
| preferences | jsonb | User preferences (flexible JSON) |
| notification_settings | jsonb | Notification delivery preferences |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### subscription_types

Defines the available subscription types in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| name | varchar(100) | Type name (e.g., "BOE", "Inmobiliaria") |
| description | text | Description of the subscription type |
| icon | varchar(50) | Icon identifier for UI rendering |
| logo | varchar(255) | URL to logo image |
| is_system | boolean | Whether this is a built-in type (true) or user-created (false) |
| created_by | uuid | Foreign key to users table (null for system types) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### subscriptions

User subscriptions with specific search parameters.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| user_id | uuid | Foreign key to users table |
| type_id | uuid | Foreign key to subscription_types table |
| name | text | User-defined subscription name |
| description | text | User-defined description |
| logo | varchar(255) | Optional logo URL |
| prompts | text[] | Array of search keywords (max 3) |
| frequency | text | Notification frequency ('immediate' or 'daily') |
| active | boolean | Whether the subscription is active |
| settings | jsonb | Type-specific settings (flexible JSON) |
| last_check_at | timestamptz | When subscription was last processed |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### notifications

Notifications generated for user subscriptions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| user_id | uuid | Foreign key to users table |
| subscription_id | uuid | Foreign key to subscriptions table |
| title | text | Notification title |
| content | text | Notification content/body |
| source_url | text | URL to the source document/page |
| metadata | jsonb | Additional data (flexible JSON) |
| read | boolean | Whether notification has been read |
| read_at | timestamptz | When notification was marked as read |
| email_sent | boolean | Whether email notification was sent |
| email_sent_at | timestamptz | When email notification was sent |
| created_at | timestamptz | Creation timestamp |

### activity_logs

Audit trail of user actions for analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| user_id | uuid | Foreign key to users table |
| action | text | Description of action performed |
| details | jsonb | Additional action details (flexible JSON) |
| created_at | timestamptz | Creation timestamp |

### subscription_templates

Reusable subscription configurations that users can apply.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| type | text | Template type identifier |
| name | text | Template name |
| description | text | Template description |
| prompts | text[] | Default search keywords |
| default_settings | jsonb | Default settings (flexible JSON) |
| created_by | uuid | Foreign key to users table (null for system templates) |
| is_public | boolean | Whether template is publicly available |
| frequency | text | Default notification frequency |
| icon | varchar(50) | Icon identifier for UI rendering |
| logo | varchar(255) | URL to logo image |
| metadata | jsonb | Additional metadata (flexible JSON) |
| created_at | timestamptz | Creation timestamp |

### feedback

User feedback on received notifications for quality improvement.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| user_id | uuid | Foreign key to users table |
| notification_id | uuid | Foreign key to notifications table (optional) |
| subscription_id | uuid | Foreign key to subscriptions table (optional) |
| type | text | Feedback type ('relevant', 'irrelevant', 'spam') |
| comment | text | Optional user comment |
| created_at | timestamptz | Creation timestamp |

### subscription_processing

Tracks background processing of subscriptions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, auto-generated |
| subscription_id | uuid | Foreign key to subscriptions table |
| last_run_at | timestamptz | When processing last occurred |
| next_run_at | timestamptz | When processing should next occur |
| status | text | Processing status ('pending', 'processing', 'completed', 'failed') |
| error | text | Error message if processing failed |
| metadata | jsonb | Additional processing data (flexible JSON) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

## Indexes

| Table | Index Name | Columns | Purpose |
|-------|------------|---------|---------|
| subscriptions | idx_subscriptions_user_id | user_id | Fast lookup of user's subscriptions |
| subscriptions | idx_subscriptions_type_id | type_id | Filter subscriptions by type |
| notifications | idx_notifications_user_id | user_id | Fast lookup of user's notifications |
| notifications | idx_notifications_subscription_id | subscription_id | Filter notifications by subscription |
| notifications | idx_notifications_email_sent | email_sent | Find notifications with email status |
| notifications | idx_notifications_email_sent_created | email_sent, created_at | Time-ordered email notifications |
| subscription_processing | idx_subscription_processing_next_run | next_run_at (WHERE status = 'pending') | Find pending subscriptions to process |
| subscription_processing | idx_subscription_processing_subscription | subscription_id | Find processing status for subscription |

## Row Level Security (RLS)

The database implements Row Level Security to ensure users can only access their own data:

1. **Function**: `current_user_id()` - Returns the current user's ID from session context
2. **Context Setting**: `SET LOCAL app.current_user_id = '<uuid>'` - Sets the current user context

### Policies

| Table | Policy | Access | Condition |
|-------|--------|--------|-----------|
| users | users_select | SELECT | id = current_user_id() |
| users | users_update | UPDATE | id = current_user_id() |
| subscription_types | subscription_types_select | SELECT | is_system OR created_by = current_user_id() |
| subscription_types | subscription_types_insert | INSERT | NOT is_system AND created_by = current_user_id() |
| subscription_types | subscription_types_update | UPDATE | NOT is_system AND created_by = current_user_id() |
| subscriptions | subscriptions_select | SELECT | user_id = current_user_id() |
| subscriptions | subscriptions_insert | INSERT | user_id = current_user_id() |
| subscriptions | subscriptions_update | UPDATE | user_id = current_user_id() |
| subscriptions | subscriptions_delete | DELETE | user_id = current_user_id() |
| notifications | notifications_select | SELECT | user_id = current_user_id() |
| notifications | notifications_update | UPDATE | user_id = current_user_id() |
| activity_logs | activity_logs_select | SELECT | user_id = current_user_id() |
| subscription_templates | templates_select | SELECT | is_public OR created_by = current_user_id() |
| feedback | feedback_all | ALL | user_id = current_user_id() |
| subscription_processing | service_full_access | ALL | true (only for app_service role) |

## Data Relationships

1. **User-Subscription relationship**:
   - One user can have many subscriptions
   - Each subscription belongs to exactly one user
   - Enforced by foreign key from `subscriptions.user_id` to `users.id`

2. **Subscription-Type relationship**:
   - Each subscription has exactly one type
   - One type can be used by many subscriptions
   - Enforced by foreign key from `subscriptions.type_id` to `subscription_types.id`

3. **Notification ownership**:
   - Notifications are linked to both a user and a subscription
   - This creates a double-linkage that allows efficient filtering
   - Enforced by foreign keys from `notifications.user_id` to `users.id` and
     `notifications.subscription_id` to `subscriptions.id`

4. **Processing status tracking**:
   - Each subscription has its processing state tracked separately
   - One-to-one relationship with cascade delete
   - Enforced by foreign key from `subscription_processing.subscription_id` to `subscriptions.id`

## Migration System

The database schema is managed through a migration system:

1. **Migration Registry**: The `schema_migrations` table tracks applied migrations
2. **Consolidated Schema**: For ease of maintenance, all schema is consolidated in a single file
3. **Incremental Updates**: New changes are applied as separate migration files

## Security Considerations

1. **Row Level Security (RLS)**: Ensures users can only access their own data
2. **Role Separation**: 
   - `app_user` role for end-user access with RLS restrictions
   - `app_service` role for background services with elevated permissions
3. **Context Management**: User context must be set before executing queries
4. **UUID Primary Keys**: Secures against sequential ID enumeration attacks

## Best Practices for Database Access

1. **Always set RLS context before queries**:
   ```js
   await setRLSContext(userId);
   const result = await query('SELECT * FROM subscriptions');
   ```

2. **Use parameterized queries**:
   ```js
   // Good
   await query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
   
   // Bad - SQL injection risk
   await query(`SELECT * FROM subscriptions WHERE id = '${subscriptionId}'`);
   ```

3. **Use transactions for multi-step operations**:
   ```js
   try {
     await query('BEGIN');
     // Multiple operations...
     await query('COMMIT');
   } catch (error) {
     await query('ROLLBACK');
     throw error;
   }
   ```

4. **Consider using the withRLSContext helper for scoped operations**:
   ```js
   const result = await withRLSContext(userId, async (client) => {
     return await client.query('SELECT * FROM subscriptions');
   });
   ```

## JSON Fields & Flexible Schemas

The following fields use JSON/JSONB for flexible schema:

1. **users.preferences**: User interface settings and preferences
2. **users.notification_settings**: Delivery preferences for notifications
3. **subscriptions.settings**: Type-specific settings for subscriptions
4. **notifications.metadata**: Additional context data for notifications
5. **activity_logs.details**: Detailed information about actions
6. **subscription_templates.default_settings**: Default settings for templates
7. **subscription_templates.metadata**: Additional template metadata
8. **subscription_processing.metadata**: Processing state metadata

This provides flexibility while maintaining structure for core data.

## Performance Notes

1. **Indexes**: Key lookup paths are indexed for performance
2. **JSONB**: Used instead of JSON for indexable JSON fields
3. **Array Limitations**: The `prompts` array is limited to 3 items for performance
4. **RLS Overhead**: Row Level Security adds some overhead but is essential for security