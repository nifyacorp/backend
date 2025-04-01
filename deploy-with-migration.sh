#!/bin/bash
# Deployment script with automatic migration
# This deploys the backend with startup migration enabled

set -e

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== NIFYA Backend Deployment with Automatic Migration ===${NC}\n"

# Check if running in Cloud Run environment
if [ -z "$PORT" ]; then
  echo -e "${YELLOW}PORT environment variable not set, assuming local deployment${NC}"
  export PORT=8080
fi

# Check for required files
if [ ! -f "./src/infrastructure/database/startup-migration.js" ]; then
  echo -e "${RED}❌ Migration file not found: ./src/infrastructure/database/startup-migration.js${NC}"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
  echo -e "${GREEN}✅ Dependencies installed${NC}"
else
  echo -e "${GREEN}✅ Dependencies already up to date${NC}"
fi

# Run build if needed
if [ ! -d "dist" ] || [ "package.json" -nt "dist" ]; then
  echo -e "${YELLOW}Building application...${NC}"
  npm run build
  echo -e "${GREEN}✅ Build completed${NC}"
else
  echo -e "${GREEN}✅ Build already up to date${NC}"
fi

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run with automatic database migration...${NC}"

# Check if we're in a GCP environment
if command -v gcloud &> /dev/null; then
  # Get project details
  PROJECT_ID=$(gcloud config get-value project)
  REGION=$(gcloud config get-value run/region || echo "us-central1")
  
  echo -e "Project: ${PROJECT_ID}, Region: ${REGION}"
  
  # Build the container
  echo -e "${YELLOW}Building container...${NC}"
  gcloud builds submit --tag gcr.io/${PROJECT_ID}/backend
  
  # Deploy with migration enabled
  echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
  gcloud run deploy backend \
    --image gcr.io/${PROJECT_ID}/backend \
    --platform managed \
    --region ${REGION} \
    --set-env-vars=USE_STARTUP_MIGRATION=true \
    --update-secrets=DB_USER=DB_USER:latest,DB_PASSWORD=DB_PASSWORD:latest,DB_NAME=DB_NAME:latest,DB_INSTANCE_CONNECTION_NAME=DB_INSTANCE_CONNECTION_NAME:latest
  
  echo -e "${GREEN}✅ Deployment completed${NC}"
else
  # If not in GCP, just run locally
  echo -e "${YELLOW}gcloud not found, running locally...${NC}"
  USE_STARTUP_MIGRATION=true npm start
fi

echo -e "\n${GREEN}=== Deployment with migration completed ===${NC}"
echo -e "${YELLOW}The service will automatically adjust the database schema on startup${NC}"