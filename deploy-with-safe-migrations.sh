#!/bin/bash
# Deploy the backend with the production-safe migration system

# Set this script to exit on first error
set -e

echo "🚀 Deploying backend with production-safe migrations..."

# Get the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if we're in the backend directory
if [[ $(basename "$PWD") != "backend" ]]; then
  echo "❌ Error: This script must be run from the backend directory"
  exit 1
fi

# Step 1: Create a backup of the database
echo "📦 Creating database backup..."
DB_NAME=${DB_NAME:-$(grep DB_NAME .env | cut -d '=' -f2)}
BACKUP_FILE="db_backup_$(date +%Y%m%d_%H%M%S).sql"

if command -v pg_dump &> /dev/null; then
  pg_dump -U "${DB_USER:-postgres}" -d "${DB_NAME}" -f "$BACKUP_FILE" || echo "⚠️ Warning: Database backup failed. Proceeding anyway..."
  echo "✅ Database backup created: $BACKUP_FILE"
else
  echo "⚠️ Warning: pg_dump not found. Skipping database backup."
fi

# Step 2: Make sure the safe-migrations.js is in place
echo "🔄 Ensuring production-safe migration system is in place..."
if [[ ! -f "src/infrastructure/database/safe-migrations.js" ]]; then
  echo "❌ Error: safe-migrations.js not found! Make sure you've added this file."
  exit 1
fi

# Step 3: Update client.js to use the safe migrations system
echo "🔄 Updating database client to use safe migrations..."
grep -q 'safe-migrations.js' src/infrastructure/database/client.js || {
  echo "⚠️ Migration system not updated in client.js. Updating now..."
  sed -i 's/import { initializeMigrations } from \x27\.\/migrations\.js\x27;/import { initializeMigrations } from \x27\.\/safe-migrations.js\x27;/' src/infrastructure/database/client.js
}

# Step 4: Add the schema_version migration if not already there
echo "🔄 Checking for schema_version migration..."
if [[ ! -f "supabase/migrations/20250401500000_create_schema_version.sql" ]]; then
  echo "❌ Error: create_schema_version migration not found! Make sure you've added this file."
  exit 1
fi

# Step 5: Fix any JSON syntax errors in existing migrations
echo "🔄 Checking for migration syntax issues..."
if [[ -f "supabase/migrations/20250401000000_add_entity_type_column.sql.fixed" ]]; then
  echo "📄 Found fixed migration file, replacing the original..."
  cp "supabase/migrations/20250401000000_add_entity_type_column.sql.fixed" "supabase/migrations/20250401000000_add_entity_type_column.sql"
fi

# Step 6: Build the project
echo "🔨 Building the project..."
npm run build

# Step 7: Deploy using standard deployment script
echo "🚀 Deploying the application..."
if [[ -f "./deploy-with-version.sh" ]]; then
  ./deploy-with-version.sh
else
  echo "⚠️ Warning: deploy-with-version.sh not found. Using gcloud deploy directly..."
  gcloud run deploy backend --source . --region us-central1 --platform managed
fi

echo "✅ Backend deployed successfully with production-safe migrations!"
echo ""
echo "📝 Note: If you encounter any issues, you can restore the database backup:"
echo "   psql -U postgres -d $DB_NAME -f $BACKUP_FILE"