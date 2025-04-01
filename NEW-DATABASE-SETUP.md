# Setting Up New NIFYA Database

This guide provides step-by-step commands to create a new PostgreSQL database for NIFYA in Google Cloud, import the schema, and configure it for use with your Cloud Run services.

## Prerequisites

- Google Cloud CLI installed and configured
- Access to your GCP project with appropriate permissions
- Access to Secret Manager

## 1. Retrieve Current Database Credentials

First, let's retrieve your existing database credentials from Secret Manager:

```bash
# Get the current project ID
PROJECT_ID=$(gcloud config get-value project)
echo "Current project: $PROJECT_ID"

# Retrieve current database credentials from Secret Manager
DB_USER=$(gcloud secrets versions access latest --secret=DB_USER)
DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)
DB_NAME=$(gcloud secrets versions access latest --secret=DB_NAME)
DB_HOST=$(gcloud secrets versions access latest --secret=DB_HOST || echo "Not found")
DB_INSTANCE_CONNECTION_NAME=$(gcloud secrets versions access latest --secret=DB_INSTANCE_CONNECTION_NAME || echo "Not found")

# Show retrieved values (without showing the password)
echo "Retrieved database user: $DB_USER"
echo "Retrieved database name: $DB_NAME"
echo "Retrieved connection name: $DB_INSTANCE_CONNECTION_NAME"
```

## 2. Create a New Cloud SQL Instance

```bash
# Set variables for the new database instance
NEW_INSTANCE_NAME="nifya-db-new"
REGION="us-central1"  # Use the same region as your Cloud Run services
TIER="db-g1-small"    # Smallest tier for development, adjust for production
DB_VERSION="POSTGRES_15"

# Create the new Cloud SQL instance
gcloud sql instances create $NEW_INSTANCE_NAME \
  --database-version=$DB_VERSION \
  --tier=$TIER \
  --region=$REGION \
  --storage-size=10GB \
  --storage-auto-increase \
  --availability-type=ZONAL \
  --backup-start-time=23:00 \
  --enable-point-in-time-recovery \
  --root-password="NewRootPassword123!"  # Change this!

# Get the connection details of the new instance
NEW_INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $NEW_INSTANCE_NAME --format='value(connectionName)')
echo "New instance connection name: $NEW_INSTANCE_CONNECTION_NAME"
```

## 3. Create Database and User

```bash
# Create a new database in the instance
gcloud sql databases create $DB_NAME --instance=$NEW_INSTANCE_NAME

# Create a user with the same username as before (to minimize changes)
gcloud sql users create $DB_USER \
  --instance=$NEW_INSTANCE_NAME \
  --password="$DB_PASSWORD"  # Reuse the existing password from secrets
```

## 4. Enable Required Extensions

```bash
# Connect to the database using Cloud SQL Proxy or psql
# First download and set up Cloud SQL Proxy if needed
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# Start Cloud SQL proxy in the background
./cloud_sql_proxy -instances=$NEW_INSTANCE_CONNECTION_NAME=tcp:5432 &
PROXY_PID=$!

# Create the extensions
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Kill the proxy when done
kill $PROXY_PID
```

## 5. Import the Schema

```bash
# Create a temporary file with just the schema (not the data)
SCHEMA_FILE="complete-schema.sql"
cp ./supabase/complete-schema.sql /tmp/$SCHEMA_FILE

# Import the schema using Cloud SQL import
gcloud sql import sql $NEW_INSTANCE_NAME /tmp/$SCHEMA_FILE \
  --database=$DB_NAME \
  --quiet

# Or using Cloud SQL Proxy
# Start Cloud SQL proxy in the background
./cloud_sql_proxy -instances=$NEW_INSTANCE_CONNECTION_NAME=tcp:5432 &
PROXY_PID=$!

# Import the schema
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f ./supabase/complete-schema.sql

# Kill the proxy when done
kill $PROXY_PID
```

## 6. Update Secret Manager with New Connection Details

```bash
# Update DB_INSTANCE_CONNECTION_NAME in Secret Manager
echo -n "$NEW_INSTANCE_CONNECTION_NAME" | gcloud secrets versions add DB_INSTANCE_CONNECTION_NAME --data-file=-

# If the DB_HOST is changing, update that too
NEW_DB_HOST=$(gcloud sql instances describe $NEW_INSTANCE_NAME --format='value(ipAddresses.ipAddress)')
echo -n "$NEW_DB_HOST" | gcloud secrets versions add DB_HOST --data-file=-

# The following should remain the same:
# - DB_USER
# - DB_PASSWORD
# - DB_NAME

echo "Secret Manager updated with new connection details"
```

## 7. Migrate Data from Old Database (Optional)

If you want to preserve your existing data:

```bash
# Start Cloud SQL proxy to old database
./cloud_sql_proxy -instances=$DB_INSTANCE_CONNECTION_NAME=tcp:5433 &
OLD_PROXY_PID=$!

# Start Cloud SQL proxy to new database
./cloud_sql_proxy -instances=$NEW_INSTANCE_CONNECTION_NAME=tcp:5432 &
NEW_PROXY_PID=$!

# Dump data from old database (excluding schema)
pg_dump -h localhost -p 5433 -U $DB_USER -d $DB_NAME --data-only > data_dump.sql

# Import data into new database
PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -f data_dump.sql

# Kill the proxies when done
kill $OLD_PROXY_PID
kill $NEW_PROXY_PID
```

## 8. Update Cloud Run Services

```bash
# List all Cloud Run services
gcloud run services list

# Update each service to use the new database
gcloud run services update backend \
  --update-secrets=DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest,DB_HOST=DB_HOST:latest

gcloud run services update notification-worker \
  --update-secrets=DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest,DB_HOST=DB_HOST:latest

gcloud run services update email-notification \
  --update-secrets=DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest,DB_HOST=DB_HOST:latest

# Repeat for any other services that connect to the database
```

## 9. Test the Services

```bash
# Get the URL of your main service
SERVICE_URL=$(gcloud run services describe backend --format='value(status.url)')

# Test a simple endpoint
curl -X GET "$SERVICE_URL/api/v1/health"
```

## 10. Backup Old Database (Optional)

Once you've verified everything is working with the new database:

```bash
# Create a full backup of your old database for archival
OLD_INSTANCE_NAME=$(echo $DB_INSTANCE_CONNECTION_NAME | cut -d':' -f2)

gcloud sql export sql $OLD_INSTANCE_NAME gs://$PROJECT_ID-backups/final_backup_$(date +%Y%m%d).sql \
  --database=$DB_NAME \
  --offload
```

## Additional Tips

1. **Verify Database Connectivity**: To check if a service can connect to the database:
   ```bash
   gcloud run services update backend --set-env-vars=DEBUG_DB_CONNECTION=true
   # Check logs for connection status
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend AND textPayload:Database connection" --limit=10
   ```

2. **Rollback if Needed**: If anything goes wrong, you can revert to the old database:
   ```bash
   # Roll back to using the old database connection
   gcloud run services update backend \
     --update-secrets=DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest-1,DB_HOST=DB_HOST:latest-1
   ```

3. **Set Up Automatic Database Backups**:
   ```bash
   gcloud sql instances patch $NEW_INSTANCE_NAME \
     --backup-start-time=23:00 \
     --backup-location=$REGION
   ```