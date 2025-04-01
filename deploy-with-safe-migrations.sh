#!/bin/bash
# Production-safe deployment script for NIFYA backend

set -e

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== NIFYA Backend Deployment with Safe Migrations ===${NC}\n"

# Check if running in Cloud Run environment
if [ -z "$PORT" ]; then
  echo -e "${YELLOW}PORT environment variable not set, assuming local deployment${NC}"
  export PORT=8080
fi

# Create backup of database if possible
if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
  echo -e "${YELLOW}Checking if database backup is possible...${NC}"
  
  # Only try to create backup if pg_dump is available
  if command -v pg_dump &> /dev/null; then
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo -e "${YELLOW}Creating database backup to $BACKUP_FILE...${NC}"
    
    if PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE 2>/dev/null; then
      echo -e "${GREEN}✅ Database backup created successfully${NC}"
    else
      echo -e "${YELLOW}⚠️ Could not create database backup, continuing without it${NC}"
    fi
  else
    echo -e "${YELLOW}pg_dump not found, skipping database backup${NC}"
  fi
fi

# Verify migration files
MIGRATIONS_DIR="./supabase/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}❌ Migrations directory not found: $MIGRATIONS_DIR${NC}"
  exit 1
fi

MIGRATION_COUNT=$(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq "0" ]; then
  echo -e "${RED}❌ No migration files found in $MIGRATIONS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}Found $MIGRATION_COUNT migration files in $MIGRATIONS_DIR${NC}"

# Install dependencies if package.json has changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
  echo -e "${GREEN}✅ Dependencies installed${NC}"
else
  echo -e "${GREEN}✅ Dependencies already up to date${NC}"
fi

# Run production build if needed
if [ ! -d "dist" ] || [ "package.json" -nt "dist" ]; then
  echo -e "${YELLOW}Building application...${NC}"
  npm run build
  echo -e "${GREEN}✅ Build completed${NC}"
else
  echo -e "${GREEN}✅ Build already up to date${NC}"
fi

# Start the application with NODE_ENV=production
echo -e "${YELLOW}Starting application with safe migrations...${NC}"
echo -e "${YELLOW}==============================================${NC}"
NODE_ENV=production node app.js

echo -e "\n${GREEN}=== Deployment completed ===${NC}"