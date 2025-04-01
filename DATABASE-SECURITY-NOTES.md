# NIFYA Database Security Notes

## Row-Level Security (RLS) Configuration

The schema in `complete-schema.sql` includes Row-Level Security (RLS) policies for all user-related tables. These policies are crucial for data isolation and security.

### How RLS Works in NIFYA

1. **Setting the User Context**:
   - Before each query, the application sets `app.current_user_id` with the user's ID
   - This is done via `SET LOCAL app.current_user_id = 'user-uuid'`
   - The database uses this setting to filter rows in tables with RLS enabled

2. **RLS Policies**:
   ```sql
   -- Example: users table policy
   CREATE POLICY users_isolation_policy ON users
     FOR ALL
     USING (id = current_setting('app.current_user_id', true)::uuid);
   ```

3. **Service Account Access**:
   - Some services (like notification-worker) may need admin access
   - These services should use a database role with BYPASSRLS capability

## Security Best Practices

### Secret Management

- Keep database credentials in Secret Manager
- Rotate credentials periodically
- Use least privilege principle for service accounts

### Connection Security

1. **Use Cloud SQL Auth Proxy**:
   - Always use Cloud SQL Auth Proxy or direct socket connections
   - Don't expose database to public internet

2. **TLS for External Connections**:
   - If external connections are required, enforce TLS
   - Configure `sslmode=require` in connection strings

### Query Security

1. **Parameterized Queries**:
   - Always use parameterized queries to prevent SQL injection
   - Avoid string concatenation for SQL statements

2. **Mitigate RLS Bypasses**:
   ```sql
   -- Don't allow users to set their own context
   REVOKE ALL ON SCHEMA pg_catalog FROM PUBLIC;
   REVOKE ALL ON pg_settings FROM PUBLIC;
   ```

## Setting Up Admin Access

For maintenance and administrative tasks:

```sql
-- Create admin role
CREATE ROLE nifya_admin WITH BYPASSRLS;

-- Grant necessary permissions
GRANT nifya_admin TO your_admin_user;

-- Create service accounts with proper permissions
CREATE USER notification_worker WITH PASSWORD 'strong_password';
GRANT nifya_admin TO notification_worker;
```

## Common Security Issues to Avoid

1. **Missing RLS Enforcement**:
   - Always set the RLS context before any query
   - Test RLS policies thoroughly

2. **Custom Functions Without Security Definer**:
   - If creating functions that need elevated privileges:
   ```sql
   CREATE OR REPLACE FUNCTION secure_function()
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     -- Function code here
   END;
   $$;
   ```

3. **Excessive Logging**:
   - Avoid logging sensitive data
   - Don't log SQL statements with parameter values
   - Redact personal data in logs

## Verify Security Setup

Run these checks to verify security configuration:

```sql
-- Check RLS is enabled on tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check RLS policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- Check available roles and privileges
SELECT r.rolname, r.rolbypassrls
FROM pg_roles r
WHERE r.rolcanlogin
ORDER BY r.rolname;
```

## Emergency Response

If a security issue is detected:

1. Revoke compromised credentials immediately
   ```sql
   ALTER USER compromised_user NOLOGIN;
   ```

2. Create new credentials for legitimate services
   ```sql
   ALTER USER legitimate_user WITH PASSWORD 'new_strong_password';
   ```

3. Audit access logs to determine impact
   ```sql
   SELECT * FROM pg_stat_activity WHERE usename = 'compromised_user';
   ```