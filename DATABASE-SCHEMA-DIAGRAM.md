# NIFYA Database Schema Diagram

```
                                         NIFYA Database Schema
                                         =====================

    +----------------+          +------------------------+          +--------------------+
    |     users      |          |    subscription_types  |          | subscription_templates |
    +----------------+          +------------------------+          +--------------------+
    | id (PK)        |          | id (PK)                |          | id (PK)            |
    | email          |          | name                   |          | name               |
    | name           |          | display_name           |          | type               |
    | role           |          | type                   |          | description        |
    | email_verified |          | description            |          | prompts (JSONB)    |
    | notification_settings (JSONB) | | icon            |          | settings (JSONB)   |
    | created_at     |          | is_system              |          | is_featured        |
    | updated_at     |          | created_at             |          | is_system          |
    +----------------+          | icon                   |          | settings (JSONB)   |
           |                    | is_system              |          | is_featured        |
           |                    | created_at             |          | is_system          |
           |                    | updated_at             |          | logo               |
           |                    +------------------------+          | created_at         |
           |                               |                       | updated_at         |
           |                               |                       +--------------------+
           |                               |
           |                               |
+----------------------+                   |
| user_email_preferences |                   |
+----------------------+                   |
| user_id (PK)(FK)     |                   |
| immediate            |                   |
| daily                |                   |
| weekly               |                   |
| created_at           |                   |
| updated_at           |                   |
+----------------------+                   |
           |                               |
           |                               |
           |     +----------------------------------------------+
           |     |               subscriptions                  |
           +-----+----------------------------------------------+
                 | id (PK)                                      |
                 | user_id (FK)                                 |
                 | type_id (FK) -------------------------+      |
                 | name                                  |      |
                 | description                           |      |
                 | prompts (JSONB)                       |      |
                 | frequency                             |      |
                 | settings (JSONB)                      |      |
                 | logo                                  |      |
                 | active                                |      |
                 | created_at                            |      |
                 | updated_at                            |      |
                 +----------------------------------------------+
                           |                             |
                           |                             |
                           |                             |
          +----------------------------------+           |
          |      subscription_processing     |           |
          +----------------------------------+           |
          | id (PK)                          |           |
          | subscription_id (FK) ------------+           |
          | status                           |           |
          | started_at                       |           |
          | completed_at                     |           |
          | result (JSONB)                   |           |
          | error_message                    |           |
          | user_id (FK)                     |           |
          | created_at                       |           |
          | updated_at                       |           |
          | requested_at                     |           |
          +----------------------------------+           |
                                                         |
                                                         |
                      +------------------------------------+
                      |          notifications              |
                      +------------------------------------+
                      | id (PK)                            |
                      | user_id (FK)                       |
                      | subscription_id (FK)               |
                      | title                              |
                      | content                            |
                      | source_url                         |
                      | read                               |
                      | read_at                            |
                      | entity_type                        |
                      | source                             |
                      | data (JSONB)                       |
                      | metadata (JSONB)                   |
                      | created_at                         |
                      | updated_at                         |
                      | email_sent                         |
                      | email_sent_at                      |
                      +------------------------------------+

                      +------------------------------------+
                      |          schema_version             |
                      +------------------------------------+
                      | version (PK)                       |
                      | applied_at                         |
                      | description                        |
                      +------------------------------------+
```

## Tables Description

1. **users**: Core user accounts table
   - Primary user identity and authentication information
   - Referenced by multiple other tables for ownership

2. **user_email_preferences**: User notification settings
   - Controls which types of email notifications a user receives
   - One-to-one relationship with users

3. **subscription_types**: Categories of subscriptions
   - Defines the types of subscriptions available in the system (BOE, Real Estate, etc.)
   - System-level configuration

4. **subscription_templates**: Pre-defined subscription templates
   - Templates that users can select when creating subscriptions
   - Contains default settings and prompts

5. **subscriptions**: User's actual subscriptions
   - Core entity for user-created subscriptions
   - Links to users and subscription types
   - Contains the specific configuration and search parameters

6. **subscription_processing**: Processing history
   - Records each attempt to process a subscription
   - Contains results, status, and error information
   - Provides audit trail of subscription runs

7. **notifications**: User notifications
   - Stores notifications generated for users
   - Links to users and optionally to subscription data
   - Tracks read status and email delivery

8. **schema_version**: Internal schema tracking
   - Used by the database migration system
   - Records which schema versions have been applied

## Key Relationships

- Users have many subscriptions (one-to-many)
- Users have one email preference record (one-to-one)
- Users have many notifications (one-to-many)
- Subscriptions belong to a subscription type (many-to-one)
- Subscriptions have many processing records (one-to-many)

## Security

All tables use Row-Level Security (RLS) policies to ensure data isolation between users. This means:

- Users can only see their own data
- The application must set the correct user context for queries
- Even if an SQL injection occurred, users would only be able to access their own data

## JSON Storage

Several tables use JSONB columns for flexible data storage:
- `prompts` in subscriptions and templates
- `settings` in subscriptions and templates
- `data` and `metadata` in notifications
- `result` in subscription_processing

This provides schema flexibility while maintaining good query performance.