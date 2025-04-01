#!/bin/bash

# Script to build and deploy the backend service with enhanced startup migration
# This script specifically enables the startup migration feature to fix database schema issues

# Generate timestamp
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get current git commit SHA
COMMIT_SHA=$(git rev-parse HEAD)

# Generate unique deployment ID
DEPLOYMENT_ID="migration-fix-$(date +%Y%m%d%H%M%S)"

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== NIFYA Backend Deployment with Enhanced Migration =====${NC}"
echo -e "${YELLOW}This deployment specifically fixes the database migration issues${NC}"
echo
echo -e "Building backend service with the following configuration:"
echo -e "  Timestamp:    ${GREEN}$BUILD_TIMESTAMP${NC}"
echo -e "  Commit:       ${GREEN}$COMMIT_SHA${NC}"
echo -e "  Deploy ID:    ${GREEN}$DEPLOYMENT_ID${NC}"
echo -e "  ${YELLOW}Migration Fix: ENABLED${NC}"
echo

# Ask for confirmation
read -p "Continue with deployment? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 0
fi

# Build the Docker image with build args and migration fix
echo -e "${YELLOW}Building Docker image...${NC}"
docker build \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  --build-arg COMMIT_SHA="$COMMIT_SHA" \
  --build-arg DEPLOYMENT_ID="$DEPLOYMENT_ID" \
  --build-arg USE_STARTUP_MIGRATION="true" \
  -t nifya-backend:migration-fix .

echo -e "${GREEN}Docker image built successfully${NC}"

# Ask if the user wants to deploy to Cloud Run
echo
read -p "Deploy to Cloud Run? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Tag and push to GCR
    echo -e "${YELLOW}Pushing image to Google Container Registry...${NC}"
    docker tag nifya-backend:migration-fix gcr.io/delta-entity-447812-p2/backend:migration-fix
    docker push gcr.io/delta-entity-447812-p2/backend:migration-fix
    
    # Deploy to Cloud Run
    echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
    gcloud run deploy backend \
      --image gcr.io/delta-entity-447812-p2/backend:migration-fix \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars="USE_STARTUP_MIGRATION=true" \
      --quiet
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Deployment to Cloud Run completed successfully!${NC}"
        echo
        echo -e "You can check logs with:"
        echo -e "  cd ../scripts && node get-logs.js backend migration"
    else
        echo -e "${RED}Deployment to Cloud Run failed${NC}"
    fi
else
    # Run container locally for testing
    echo -e "${YELLOW}Running container locally for testing...${NC}"
    docker run --rm -p 3000:3000 \
      -e USE_STARTUP_MIGRATION=true \
      nifya-backend:migration-fix
    
    echo
    echo -e "${GREEN}Access the service at: http://localhost:3000${NC}"
    echo -e "Access health check at: http://localhost:3000/health"
    echo -e "Access version info at: http://localhost:3000/version"
fi