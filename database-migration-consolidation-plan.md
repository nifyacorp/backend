# Database Migration Consolidation Plan

## Current Issues

Based on the deployment error logs, we're experiencing several issues:

1. **Migration Failures**: The latest migration file (`20250401000000_add_entity_type_column.sql`) has syntax errors related to JSON formatting.
2. **Too Many Migration Files**: Multiple incremental migrations make deployments slower and error-prone.
3. **Inconsistent Migration Structure**: Different migrations handle schema changes in inconsistent ways.

## Consolidation Plan

### Phase 1: Create a Consolidated Schema Definition

1. **Create a Single Schema File**:
   - Create a new file called `consolidated_schema.sql` containing the complete database schema
   - Include all tables, indices, functions, and triggers
   - Add proper Row Level Security (RLS) policies
   - Include comments for all tables and columns

2. **Use Consistent JSON Formatting**:
   - Ensure all JSON default values use proper JSON format with double quotes
   - Example: `DEFAULT '{"status": "pending"}'::jsonb` instead of `DEFAULT {status: pending}::jsonb`

### Phase 2: Create Reset Migration

Create a migration file that can reset the database to a known good state:

```sql
-- 20250402000000_consolidated_schema_reset.sql

-- Drop everything with CASCADE
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Include the complete schema definition
-- ... [content from consolidated_schema.sql] ...

-- Add base data
INSERT INTO subscription_types (id, name, display_name, icon, created_at, updated_at)
VALUES 
  ('boe', 'boe', 'BOE', 'FileText', NOW(), NOW()),
  ('doga', 'doga', 'DOGA', 'FileText', NOW(), NOW()),
  ('real-estate', 'real-estate', 'Real Estate', 'Home', NOW(), NOW());

-- Set version control
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_version (version, description)
VALUES ('20250402000000', 'Consolidated schema reset');
```

### Phase 3: Implement Version Control System

Create a proper version control system for the database:

```sql
-- Functions for version tracking
CREATE OR REPLACE FUNCTION check_schema_version(required_version VARCHAR) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_version 
    WHERE version = required_version
  );
END;
$$ LANGUAGE plpgsql;

-- Function to register a version
CREATE OR REPLACE FUNCTION register_schema_version(version_id VARCHAR, version_description TEXT) 
RETURNS VOID AS $$
BEGIN
  INSERT INTO schema_version (version, description)
  VALUES (version_id, version_description);
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: Improve Migration Process

1. **Simplify Migration Runner**:
   - Modify the existing migration system to work with the new consolidated approach
   - Add version checking to prevent re-applying migrations
   - Include better error handling and reporting

2. **Create a New Migration Strategy**:
   - All future migrations should be self-contained and idempotent
   - Each migration should check if it needs to run based on schema_version table
   - Migrations should be cumulative when possible to reduce the number of files

## Implementation Strategy

### Step 1: Create Consolidated Schema

Extract the complete schema from the existing database:

```bash
# Dump the current schema (without data)
pg_dump --schema-only --no-owner --no-acl DATABASE_NAME > consolidated_schema.sql

# Clean up the file to make it more readable
# Remove unneeded commands and add proper organization
```

### Step 2: Create New Migration System

1. Create a new migration runner with improved error handling:

```javascript
// Improved migration runner pseudocode
async function applyMigration(migrationPath, client) {
  const content = await fs.readFile(migrationPath, 'utf8');
  
  // Extract version from filename
  const versionMatch = path.basename(migrationPath).match(/^(\d+)_/);
  const version = versionMatch ? versionMatch[1] : 'unknown';
  
  // Check if already applied
  const versionCheck = await client.query(
    'SELECT version FROM schema_version WHERE version = $1',
    [version]
  );
  
  if (versionCheck.rows.length > 0) {
    console.log(`Migration ${version} already applied, skipping`);
    return;
  }
  
  // Apply migration within transaction
  try {
    await client.query('BEGIN');
    
    // Execute migration SQL
    await client.query(content);
    
    // Register version
    await client.query(
      'INSERT INTO schema_version (version, description) VALUES ($1, $2)',
      [version, `Migration from file ${path.basename(migrationPath)}`]
    );
    
    await client.query('COMMIT');
    console.log(`Applied migration: ${version}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
```

### Step 3: Fix JSON Syntax in Migrations

Review all migrations for proper JSON syntax:

1. Look for patterns like:
   - `DEFAULT {key: value}::jsonb` which should be `DEFAULT '{"key": "value"}'::jsonb`
   - Unquoted keys or values in JSON objects
   - Missing commas between JSON properties

2. Special attention to the failing migration:
   - Fix `Token "boe" is invalid` error by properly formatting the JSON

### Step 4: Documentation and Testing

1. Create comprehensive documentation on the new migration system
2. Create test scripts to validate migrations before deployment
3. Implement a validation step that checks SQL syntax before attempting migrations

## Best Practices for Schema Management

### 1. Use Typed Schema Definitions

Implement TypeScript interfaces that match your database schema:

```typescript
// Create a schema directory with table definitions
// src/schema/tables/subscriptions.ts
export interface Subscription {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  type_id: string;
  prompts: string[];
  frequency: 'immediate' | 'daily' | 'weekly';
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Generate SQL creation statements from these types
// This ensures schema and code stay in sync
```

### 2. Implement Repository Pattern

Create repository classes for each entity instead of direct SQL:

```typescript
class SubscriptionRepository {
  // Type-safe methods for database operations
  async findById(id: string): Promise<Subscription | null> {
    // Implementation using prepared statements
  }
  
  async create(data: SubscriptionCreateInput): Promise<Subscription> {
    // Implementation using prepared statements
  }
  
  // etc.
}
```

### 3. Use Database Migrations Tool

Consider using established migration tools:

1. **node-pg-migrate**: Provides a robust framework for PostgreSQL migrations
2. **Knex.js**: SQL query builder with migration support
3. **TypeORM**: ORM with schema synchronization and migration generation

### 4. Implement Schema Validation

Add validation between your code models and database schema:

```typescript
// On application startup
async function validateDatabaseSchema() {
  // Check if database tables match expected schema
  const tableCheck = await query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  
  // Compare with expected schema and report mismatches
}
```

### 5. Better Error Handling for Migrations

Improve error messages with context:

```javascript
try {
  // Apply migration
} catch (error) {
  // Enhance error with context
  const enhancedError = new AppError(
    'MIGRATION_ERROR',
    `Migration failed: ${error.message}`,
    500,
    {
      migrationFile,
      lineNumber: getErrorLineNumber(error),
      sqlStatement: extractFailedStatement(error, sqlContent)
    }
  );
  throw enhancedError;
}
```

## Benefits of This Approach

1. **Simplified Deployments**: A single consolidated schema reduces deployment complexity
2. **Better Error Handling**: Improved error messages make debugging easier
3. **Type Safety**: TypeScript interfaces ensure code and schema stay in sync
4. **Version Control**: Proper tracking of applied migrations prevents errors
5. **Improved Maintainability**: Cleaner separation of concerns makes the codebase easier to understand

## Next Steps

1. Create the consolidated schema file
2. Implement the improved migration system
3. Fix the JSON syntax issues in existing migrations
4. Add validation and testing to prevent future migration failures