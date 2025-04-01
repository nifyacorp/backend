# Schema Management Best Practices for Node.js/PostgreSQL Applications

## Common Issues in Schema Management

Many Node.js applications that use PostgreSQL suffer from these common issues:

1. **Spaghetti SQL Code**: Inline SQL scattered throughout the codebase
2. **Inconsistent Error Handling**: Different approaches to handling database errors
3. **Poor Transaction Management**: Lack of proper transaction boundaries
4. **No Type Safety**: Disconnection between database schema and application types
5. **Migration Headaches**: Difficult and error-prone migration processes
6. **Inadequate Testing**: Lack of database schema validation

## Best Practices

### 1. Use a Repository Pattern

Centralize database access through repository classes:

```typescript
// src/repositories/subscription.repository.ts
export class SubscriptionRepository {
  // Constructor with database client dependency
  constructor(private db) {}
  
  // CRUD operations with proper typing
  async findById(id: string): Promise<Subscription | null> {
    const result = await this.db.query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }
  
  async create(data: SubscriptionCreateDto): Promise<Subscription> {
    const result = await this.db.query(
      `INSERT INTO subscriptions 
        (name, description, user_id, type_id, prompts, frequency, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [data.name, data.description, data.userId, data.typeId, 
       JSON.stringify(data.prompts), data.frequency, data.active]
    );
    return this.mapToEntity(result.rows[0]);
  }
  
  // Convert database row to entity object
  private mapToEntity(row: any): Subscription {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      typeId: row.type_id,
      prompts: row.prompts,
      frequency: row.frequency,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

### 2. Use a Query Builder or ORM

Consider using a query builder or ORM for complex queries:

#### Knex.js (Query Builder)

```javascript
const subscriptions = await knex('subscriptions')
  .select('subscriptions.*', 'subscription_types.name as type_name')
  .join('subscription_types', 'subscriptions.type_id', 'subscription_types.id')
  .where('subscriptions.user_id', userId)
  .orderBy('subscriptions.created_at', 'desc');
```

#### TypeORM (Full ORM)

```typescript
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;
  
  @Column({ nullable: true })
  description: string;
  
  @Column({ name: 'user_id' })
  userId: string;
  
  @ManyToOne(() => SubscriptionType)
  @JoinColumn({ name: 'type_id' })
  type: SubscriptionType;
  
  @Column('jsonb')
  prompts: string[];
  
  @Column()
  frequency: string;
  
  @Column()
  active: boolean;
  
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 3. Implement a Transaction Manager

Use a transaction helper for atomic operations:

```typescript
export async function withTransaction<T>(callback: (client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Usage:
const result = await withTransaction(async (client) => {
  // Multiple database operations within a transaction
  const subscription = await client.query('INSERT INTO subscriptions...');
  await client.query('INSERT INTO subscription_processing...');
  return subscription.rows[0];
});
```

### 4. Create a Robust Migration System

#### Option 1: Use a dedicated migration tool

Tools like `node-pg-migrate` provide a structured approach:

```javascript
// migrations/1617293000000_create_subscriptions.js
exports.up = pgm => {
  pgm.createTable('subscriptions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    user_id: { type: 'uuid', notNull: true, references: 'users' },
    type_id: { type: 'text', notNull: true, references: 'subscription_types' },
    prompts: { type: 'jsonb', notNull: true, default: '[]' },
    frequency: { type: 'text', notNull: true },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  
  pgm.createIndex('subscriptions', 'user_id');
};

exports.down = pgm => {
  pgm.dropTable('subscriptions');
};
```

#### Option 2: Create a custom migration system

```javascript
// Custom migration runner with version checking
async function runMigrations() {
  // Get applied migrations
  const result = await query('SELECT version FROM schema_version ORDER BY applied_at');
  const appliedMigrations = new Set(result.rows.map(row => row.version));
  
  // Get migration files
  const migrationFiles = await fs.readdir('./migrations');
  
  // Sort by version number
  migrationFiles.sort();
  
  // Apply each migration in a transaction
  for (const file of migrationFiles) {
    const version = file.split('_')[0];
    
    // Skip if already applied
    if (appliedMigrations.has(version)) {
      console.log(`Migration ${version} already applied, skipping`);
      continue;
    }
    
    console.log(`Applying migration: ${file}`);
    
    const sql = await fs.readFile(`./migrations/${file}`, 'utf8');
    
    await withTransaction(async (client) => {
      // Execute migration SQL
      await client.query(sql);
      
      // Record that this migration was applied
      await client.query(
        'INSERT INTO schema_version (version, description) VALUES ($1, $2)',
        [version, file]
      );
    });
  }
}
```

### 5. Implement Type Safety

Use TypeScript interfaces that match your database schema:

```typescript
// src/models/subscription.model.ts
export interface Subscription {
  id: string;
  name: string;
  description?: string;
  userId: string;
  typeId: string;
  prompts: string[];
  frequency: 'immediate' | 'daily' | 'weekly';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data Transfer Objects for API operations
export interface SubscriptionCreateDto {
  name: string;
  description?: string;
  userId: string;
  typeId: string;
  prompts: string[];
  frequency: 'immediate' | 'daily' | 'weekly';
  active?: boolean;
}

export interface SubscriptionUpdateDto {
  name?: string;
  description?: string;
  prompts?: string[];
  frequency?: 'immediate' | 'daily' | 'weekly';
  active?: boolean;
}
```

### 6. Centralize SQL Queries

Create a queries directory with well-documented SQL:

```typescript
// src/database/queries/subscriptions.ts
export const subscriptionQueries = {
  findById: `
    SELECT s.*, t.name as type_name, t.display_name as type_display_name
    FROM subscriptions s
    LEFT JOIN subscription_types t ON s.type_id = t.id
    WHERE s.id = $1
  `,
  
  findByUser: `
    SELECT s.*, t.name as type_name, t.display_name as type_display_name
    FROM subscriptions s
    LEFT JOIN subscription_types t ON s.type_id = t.id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
  `,
  
  create: `
    INSERT INTO subscriptions
      (name, description, user_id, type_id, prompts, frequency, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
  
  // Additional queries...
};
```

### 7. Implement Database Schema Validation

Create a startup validation routine:

```typescript
// src/database/schema-validator.ts
async function validateDatabaseSchema() {
  console.log('Validating database schema...');
  
  // Check required tables
  const requiredTables = ['users', 'subscriptions', 'subscription_types', 'notifications'];
  const tableResult = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  const existingTables = tableResult.rows.map(row => row.table_name);
  const missingTables = requiredTables.filter(table => !existingTables.includes(table));
  
  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
  }
  
  // Check subscriptions table schema
  const subscriptionsColumnsResult = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns
    WHERE table_name = 'subscriptions'
  `);
  
  // Define expected schema
  const expectedColumns = {
    'id': 'uuid',
    'name': 'text',
    'description': 'text',
    'user_id': 'uuid',
    'type_id': 'text',
    'prompts': 'jsonb',
    'frequency': 'text',
    'active': 'boolean',
    'created_at': 'timestamp with time zone',
    'updated_at': 'timestamp with time zone'
  };
  
  // Validate columns
  const actualColumns = {};
  subscriptionsColumnsResult.rows.forEach(row => {
    actualColumns[row.column_name] = row.data_type;
  });
  
  for (const [column, expectedType] of Object.entries(expectedColumns)) {
    if (!actualColumns[column]) {
      throw new Error(`Missing column in subscriptions table: ${column}`);
    }
    
    if (actualColumns[column] !== expectedType) {
      throw new Error(`Column ${column} has wrong data type. Expected: ${expectedType}, Actual: ${actualColumns[column]}`);
    }
  }
  
  console.log('Database schema validation successful');
}
```

### 8. Use Prepared Statements Consistently

Always use parameterized queries to prevent SQL injection:

```typescript
// Unsafe - Never do this
const badQuery = `SELECT * FROM users WHERE email = '${userInput}'`;

// Safe - Always do this
const goodQuery = 'SELECT * FROM users WHERE email = $1';
const result = await client.query(goodQuery, [userInput]);
```

### 9. Implement Database Logging and Monitoring

```typescript
// Enhanced query function with logging
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log queries that take longer than 100ms
    if (duration > 100) {
      console.warn('Slow query:', {
        text,
        duration,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Query error:', {
      text,
      params,
      error: error.message,
      duration
    });
    throw error;
  }
}
```

### 10. Add Database Integration Tests

Use a test database for integration tests:

```typescript
// tests/integration/subscription.repository.test.ts
describe('SubscriptionRepository', () => {
  let repository;
  let testDb;
  
  beforeAll(async () => {
    // Set up test database
    testDb = await setupTestDatabase();
    repository = new SubscriptionRepository(testDb);
  });
  
  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });
  
  test('should create a subscription', async () => {
    const data = {
      name: 'Test Subscription',
      description: 'For testing purposes',
      userId: '00000000-0000-0000-0000-000000000001', // Test user ID
      typeId: 'boe',
      prompts: ['keyword1', 'keyword2'],
      frequency: 'daily'
    };
    
    const subscription = await repository.create(data);
    
    expect(subscription).toHaveProperty('id');
    expect(subscription.name).toBe(data.name);
    expect(subscription.prompts).toEqual(data.prompts);
  });
  
  // Additional tests...
});
```

## Specific Anti-Patterns to Avoid

### 1. String Concatenation in SQL

❌ **Bad**:
```javascript
const query = `SELECT * FROM subscriptions WHERE user_id = '${userId}'`;
```

✅ **Good**:
```javascript
const query = 'SELECT * FROM subscriptions WHERE user_id = $1';
const result = await client.query(query, [userId]);
```

### 2. Nested Try-Catch Blocks

❌ **Bad**:
```javascript
try {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  try {
    const subscriptions = await query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    try {
      // More nested queries...
    } catch (error3) {
      // Handle error3
    }
  } catch (error2) {
    // Handle error2
  }
} catch (error1) {
  // Handle error1
}
```

✅ **Good**:
```javascript
async function getUserWithSubscriptions(userId) {
  try {
    const user = await userRepository.findById(userId);
    if (!user) return null;
    
    const subscriptions = await subscriptionRepository.findByUserId(userId);
    return { user, subscriptions };
  } catch (error) {
    logger.error('Failed to get user with subscriptions', { userId, error });
    throw new AppError('USER_FETCH_ERROR', 'Failed to retrieve user data', 500);
  }
}
```

### 3. Multiple Connection Management

❌ **Bad**:
```javascript
// Create a new connection for each request
const pool = new Pool(config);
const client = await pool.connect();
try {
  // Use client
} finally {
  client.release();
}
```

✅ **Good**:
```javascript
// Use a connection pool
const pool = new Pool(config);

// Reuse the pool for queries
export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
```

### 4. Inconsistent Error Handling

❌ **Bad**:
```javascript
// Different error handling strategies across the codebase
try {
  // Some database operation
} catch (error) {
  console.error(error);
  return null; // Silently fail
}

// Elsewhere...
try {
  // Similar database operation
} catch (error) {
  throw new Error(`Database error: ${error.message}`); // Throw generic error
}
```

✅ **Good**:
```javascript
// Centralized error handling
try {
  // Database operation
} catch (error) {
  throw new AppError(
    'DATABASE_ERROR',
    'Failed to perform operation',
    500,
    { originalError: error.message }
  );
}
```

## Conclusion

Following these best practices will lead to:
1. **Maintainable Code**: Clear structure and separation of concerns
2. **Type Safety**: Better integration between TypeScript and PostgreSQL
3. **Improved Error Handling**: Consistent approach to database errors
4. **Better Performance**: Optimized queries and connection management
5. **Robust Migrations**: Reliable schema evolution without bugs
6. **Easier Testing**: Proper abstractions make testing easier

Implementing these patterns can transform spaghetti database code into a maintainable, type-safe, and robust data access layer that will be easier to extend and maintain over time.