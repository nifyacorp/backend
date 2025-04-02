# Database Query Compatibility Analysis

This document analyzes queries used by NIFYA services and their compatibility with the enhanced database schema introduced by the startup migration system.

## Analyzed Services

- Backend API
- Notification Service
- Subscription Service
- Email Notification Service

## Query Analysis

### Notification Service

| File | Query | Compatibility | Notes |
|------|-------|--------------|-------|
| notification-repository.js | `SELECT n.id, n.user_id, n.subscription_id, n.title, n.content, n.source_url as "sourceUrl", n.read, n.metadata, n.created_at as "createdAt", n.read_at as "readAt", s.name as subscription_name FROM notifications n LEFT JOIN subscriptions s ON n.subscription_id = s.id WHERE n.user_id = $1` | ✅ Compatible | Uses correct new columns (`subscription_id`, `source_url`, `read_at`) |
| notification-repository.js | `UPDATE notifications SET read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *` | ✅ Compatible | Properly sets `read_at` timestamp |
| notification-repository.js | `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id` | ✅ Compatible | Uses standard columns |
| notification-repository.js | `SELECT COALESCE(CASE WHEN metadata ? 'source' THEN metadata->>'source' WHEN metadata ? 'type' THEN metadata->>'type' ELSE 'unknown' END, 'unknown') as type, COUNT(*) as count FROM notifications WHERE user_id = $1 GROUP BY type ORDER BY count DESC` | ✅ Compatible | Properly handles JSONB metadata column |
| user-email-preferences.repository.js | `UPDATE notifications SET email_sent = TRUE, email_sent_at = $1 WHERE id = ANY($2) RETURNING id` | ✅ Compatible | Uses the `email_sent_at` column correctly |

### Subscription Service

| File | Query | Compatibility | Notes |
|------|-------|--------------|-------|
| subscription.repository.js | `SELECT COUNT(*) as total FROM subscriptions WHERE user_id = $1` | ✅ Compatible | Simple count query |
| subscription.repository.js | `SELECT s.id, s.type_id, s.name, s.description, s.prompts, s.logo, s.frequency, s.active, s.created_at as "createdAt", s.updated_at as "updatedAt" FROM subscriptions s WHERE s.user_id = $1 ORDER BY s.${sortField} ${sortOrder} LIMIT $2 OFFSET $3` | ✅ Compatible | Uses standard columns |
| subscription.repository.js | `SELECT id, type, name as "typeName", icon as "typeIcon" FROM subscription_types WHERE id = ANY($1::uuid[])` | ⚠️ Warning | The `type` column might not exist in the new schema; `name` should be used instead |
| subscription.service.js | `SELECT id FROM subscription_types WHERE id = $1` | ✅ Compatible | Basic primary key lookup |
| subscription.service.js | `SELECT id FROM subscription_templates WHERE id = $1` | ✅ Compatible | Basic primary key lookup |
| subscription.service.js | `SELECT st.id FROM subscription_types st JOIN subscription_templates t ON LOWER(st.name) = LOWER(t.type) WHERE t.id = $1` | ⚠️ Warning | Join might be problematic; assumes `type` column in templates |
| subscription.service.js | `SELECT type FROM subscription_templates WHERE id = $1` | ✅ Compatible | Basic column selection |
| subscription.service.js | `SELECT id FROM subscription_types WHERE name = $1` | ✅ Compatible | Basic lookup |
| subscription.service.js | `SELECT id FROM subscription_types WHERE LOWER(name) = LOWER($1)` | ✅ Compatible | Case-insensitive lookup |
| subscription.service.js | `SELECT id FROM subscription_types WHERE LOWER(name) = LOWER($1) OR LOWER(description) LIKE LOWER($2)` | ⚠️ Warning | `description` might not exist in enhanced schema |
| subscription.service.js | `SELECT id FROM subscription_types WHERE is_system = true LIMIT 1` | ✅ Compatible | Uses the `is_system` column that the enhanced migration ensures exists |
| subscription.service.js | `INSERT INTO subscriptions (${fields.join(', ')}) VALUES (${placeholders}) RETURNING id, name, description, type_id, prompts, frequency, logo, active, created_at, updated_at` | ✅ Compatible | Dynamic fields insertion |
| subscription.service.js | `SELECT type, name FROM subscription_types WHERE id = $1` | ⚠️ Warning | The `type` column might not exist in enhanced schema |
| subscription.service.js | `INSERT INTO subscription_processing (subscription_id, status, requested_at, user_id) VALUES ($1, 'pending', NOW(), $2) RETURNING id` | ✅ Compatible | Uses standard columns |

### User Email Preferences

| File | Query | Compatibility | Notes |
|------|-------|--------------|-------|
| user-email-preferences.repository.js | `SELECT email_notifications, notification_email, digest_time FROM users WHERE id = $1` | ❌ Incompatible | Columns might not exist in the enhanced schema; should use `notification_settings` JSONB |
| user-email-preferences.repository.js | `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING email_notifications, notification_email, digest_time` | ❌ Incompatible | Same issue as above |
| user-email-preferences.repository.js | `SELECT id, email, notification_email, digest_time FROM users WHERE email_notifications = TRUE ORDER BY id LIMIT $1 OFFSET $2` | ❌ Incompatible | Same issue as above |
| user-email-preferences.repository.js | `SELECT n.id, n.type, n.content, n.user_id, n.created_at, n.read, s.name as subscription_name FROM notifications n LEFT JOIN subscriptions s ON (n.content->>'subscriptionId') = s.id::text WHERE n.user_id = $1 AND n.email_sent = FALSE` | ⚠️ Warning | The `type` column and join on content JSON might be problematic |

## Recommendations

1. **Notification Services**:
   - All queries appear compatible with the enhanced schema
   - No changes needed

2. **Subscription Services**:
   - Most queries are compatible
   - Update queries that reference the `type` column in `subscription_types` table to use `name` instead
   - Review joins between `subscription_types` and `subscription_templates`

3. **User Email Preferences**:
   - Update queries to use the `notification_settings` JSONB column instead of individual columns
   - Implement the following changes:

```javascript
// Before
const result = await query(
  `SELECT 
    email_notifications, 
    notification_email, 
    digest_time
  FROM users
  WHERE id = $1`,
  [userId]
);

// After
const result = await query(
  `SELECT 
    notification_settings
  FROM users
  WHERE id = $1`,
  [userId]
);

// Transform the result
const settings = result.rows[0]?.notification_settings || {
  emailNotifications: false,
  notificationEmail: null,
  emailFrequency: 'daily'
};

return {
  email_notifications: settings.emailNotifications,
  notification_email: settings.notificationEmail,
  digest_time: '08:00:00' // Default
};
```

4. **General Recommendations**:
   - Add field existence checks to queries that reference columns that might not exist in all environments
   - Consider using the repository pattern more consistently across services
   - Standardize on JSONB column structures across services

## Schema Evolution Plan

1. **Short-term**:
   - Deploy the startup migration system to fix immediate issues
   - Update the `user-email-preferences.repository.js` file to use the JSONB structure

2. **Mid-term**:
   - Consolidate column naming conventions (e.g., use snake_case everywhere or camelCase everywhere)
   - Ensure all services properly handle JSONB columns
   - Add a database abstraction layer to handle schema differences

3. **Long-term**:
   - Consider a complete schema refresh with properly defined types and relationships
   - Move to a formal migration framework like Knex.js or TypeORM
   - Add automated schema validation and testing