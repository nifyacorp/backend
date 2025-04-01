# Verifying Your New Database Setup

After setting up your new database using the commands in `NEW-DATABASE-SETUP.md`, follow these steps to verify everything is working correctly.

## 1. Verify Database Connectivity

```bash
# Start Cloud SQL proxy to connect to your new database
./cloud_sql_proxy -instances=[YOUR_NEW_INSTANCE_CONNECTION_NAME]=tcp:5432 &
PROXY_PID=$!

# Connect to the database and check for tables
PGPASSWORD=[YOUR_DB_PASSWORD] psql -h localhost -U [YOUR_DB_USER] -d [YOUR_DB_NAME] -c "\dt"

# This should show all the tables from the schema:
# - users
# - subscriptions
# - notifications
# - etc.

# Check if schema_version table has entries
PGPASSWORD=[YOUR_DB_PASSWORD] psql -h localhost -U [YOUR_DB_USER] -d [YOUR_DB_NAME] -c "SELECT * FROM schema_version;"

# Kill the proxy when done
kill $PROXY_PID
```

## 2. Test with a Simple Service

Create a test script to verify database connectivity:

```bash
# Save this as test-db-connection.js
const { Pool } = require('pg');

// Use environment variables or replace with your actual values
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

async function testConnection() {
  try {
    // Try to connect
    const client = await pool.connect();
    console.log('Successfully connected to database');
    
    // Check what tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables found:', result.rows.map(row => row.table_name));
    
    // Release client
    client.release();
    await pool.end();
    
    return { success: true, tables: result.rows.length };
  } catch (error) {
    console.error('Database connection error:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testConnection()
  .then(result => console.log('Test result:', result))
  .catch(err => console.error('Test failed:', err));
```

Run it with your new database credentials:

```bash
DB_HOST=localhost DB_USER=[YOUR_DB_USER] DB_PASSWORD=[YOUR_DB_PASSWORD] DB_NAME=[YOUR_DB_NAME] node test-db-connection.js
```

## 3. Verify Service Configuration

Once the database is confirmed working, check your service configuration:

```bash
# Check that your services are using the correct secrets
gcloud run services describe backend --format="yaml(spec.template.spec.containers[0].env)"

# Look for environment variables that use secrets:
# - DB_USER
# - DB_PASSWORD
# - DB_NAME
# - DB_HOST
# - DB_INSTANCE_CONNECTION_NAME
```

## 4. Deploy a Test Service

Deploy a minimal test service to verify end-to-end connectivity:

```bash
# Create a minimal service that connects to the database
# Save this in a file called app.js
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Database connection
const pool = new Pool({
  // If running on Cloud Run, use Cloud SQL socket
  host: process.env.DB_INSTANCE_CONNECTION_NAME 
    ? `/cloudsql/${process.env.DB_INSTANCE_CONNECTION_NAME}`
    : process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false
});

// Health check endpoint
app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) FROM users');
    const userCount = result.rows[0].count;
    client.release();
    
    res.json({
      status: 'ok',
      database: 'connected',
      users: userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, () => {
  console.log(`Test service listening on port ${port}`);
});
```

Deploy it:

```bash
# Create a minimal Dockerfile
cat > Dockerfile << EOF
FROM node:18-slim
WORKDIR /app
COPY package.json .
RUN npm install express pg
COPY app.js .
CMD ["node", "app.js"]
EOF

# Create package.json
cat > package.json << EOF
{
  "name": "db-test",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3"
  }
}
EOF

# Build and deploy
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/db-test
gcloud run deploy db-test \
  --image gcr.io/[YOUR_PROJECT_ID]/db-test \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --update-secrets=DB_USER=DB_USER:latest,DB_PASSWORD=DB_PASSWORD:latest,DB_NAME=DB_NAME:latest,DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest

# Get the service URL
SERVICE_URL=$(gcloud run services describe db-test --format='value(status.url)')

# Test it
curl $SERVICE_URL
```

## 5. Common Issues & Troubleshooting

### Connection Refused

If you see "connection refused" errors:

1. Check that the Cloud SQL Auth Proxy is running
2. Verify your IP is allowed in the Cloud SQL authorized networks
3. Check that the service account has cloudsql.client permissions

### Permission Errors

If you see permission errors:

1. Check that your DB user has appropriate permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE [YOUR_DB_NAME] TO [YOUR_DB_USER];
   ```

2. Verify service account permissions:
   ```bash
   gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] \
     --member=serviceAccount:[YOUR_SERVICE_ACCOUNT] \
     --role=roles/cloudsql.client
   ```

### Missing Tables

If database connects but queries fail:

1. Verify schema was properly imported:
   ```bash
   PGPASSWORD=[YOUR_DB_PASSWORD] psql -h localhost -U [YOUR_DB_USER] -d [YOUR_DB_NAME] -c "\dt"
   ```

2. Check for schema version records:
   ```bash
   PGPASSWORD=[YOUR_DB_PASSWORD] psql -h localhost -U [YOUR_DB_USER] -d [YOUR_DB_NAME] -c "SELECT * FROM schema_version;"
   ```

3. Manually import schema again if needed:
   ```bash
   PGPASSWORD=[YOUR_DB_PASSWORD] psql -h localhost -U [YOUR_DB_USER] -d [YOUR_DB_NAME] -f ./supabase/complete-schema.sql
   ```

## 6. Final Verification Checklist

- [ ] Database connection succeeds
- [ ] All tables from schema exist
- [ ] Services can connect to the database
- [ ] Queries execute successfully
- [ ] Row-Level Security works correctly
- [ ] Connection pooling is appropriately configured
- [ ] Services restart without connectivity issues