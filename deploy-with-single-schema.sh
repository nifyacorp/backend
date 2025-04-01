#!/bin/bash
# Single Schema Deployment Script for NIFYA backend
# This script uses a single schema file instead of multiple migrations

set -e

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== NIFYA Backend Deployment with Single Schema ===${NC}\n"

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

# Verify schema file
SCHEMA_FILE="./supabase/complete-schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}❌ Schema file not found: $SCHEMA_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}Found schema file: $SCHEMA_FILE${NC}"

# Install dependencies if package.json has changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
  echo -e "${GREEN}✅ Dependencies installed${NC}"
else
  echo -e "${GREEN}✅ Dependencies already up to date${NC}"
fi

# Build application if needed
if [ ! -d "dist" ] || [ "package.json" -nt "dist" ]; then
  echo -e "${YELLOW}Building application...${NC}"
  npm run build
  echo -e "${GREEN}✅ Build completed${NC}"
else
  echo -e "${GREEN}✅ Build already up to date${NC}"
fi

# Modify the client.js file to use single schema approach
echo -e "${YELLOW}Configuring application to use single schema approach...${NC}"

CLIENT_FILE="./src/infrastructure/database/client.js"
if [ -f "$CLIENT_FILE" ]; then
  # Update USE_SINGLE_SCHEMA setting
  sed -i 's/const USE_SINGLE_SCHEMA = false/const USE_SINGLE_SCHEMA = true/g' "$CLIENT_FILE"
  echo -e "${GREEN}✅ Client configured to use single schema${NC}"
else
  echo -e "${RED}❌ Client file not found: $CLIENT_FILE${NC}"
  exit 1
fi

# Set environment variable to delay migrations (allows container to start)
export DELAY_MIGRATIONS=true

# Start the application
echo -e "${YELLOW}Starting application with single schema...${NC}"
echo -e "${YELLOW}==============================================${NC}"
NODE_ENV=production node src/index.js

echo -e "\n${GREEN}=== Deployment completed ===${NC}"