#!/bin/bash
# Template Service Fix Deployment Script

echo "Starting Template Service Fix Deployment..."

# Set environment variables
export PROJECT_ID="delta-entity-447812-p2"
export SERVICE_NAME="backend"
export REGION="us-central1"

# Step 1: Make sure we have the latest code
echo "Ensuring we have the latest code..."
git pull

# Step 2: Create a tag for the deployment
TAG="template-service-fix-$(date +%Y%m%d-%H%M%S)"
echo "Creating tag: $TAG"
git tag -a "$TAG" -m "Template service fix deployment - $(date)"

# Step 3: Set up Google Cloud if needed
if ! command -v gcloud &> /dev/null; then
  echo "gcloud not found. Please install the Google Cloud SDK first."
  exit 1
fi

# Ensure we're authenticated
if ! gcloud auth list | grep -q "ACTIVE"; then
  echo "Not authenticated with gcloud. Please run 'gcloud auth login' first."
  exit 1
fi

# Step 4: Build new image
echo "Building new Docker image..."
gcloud builds submit \
  --project="$PROJECT_ID" \
  --tag="gcr.io/$PROJECT_ID/$SERVICE_NAME:$TAG" \
  --timeout=15m

if [ $? -ne 0 ]; then
  echo "Error building Docker image. Exiting."
  exit 1
fi

# Step 5: Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --image="gcr.io/$PROJECT_ID/$SERVICE_NAME:$TAG" \
  --platform=managed \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-env-vars="VERSION=$TAG,BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ),COMMIT_SHA=$TAG"

if [ $? -ne 0 ]; then
  echo "Error deploying to Cloud Run. Exiting."
  exit 1
fi

# Step 6: Check deployment status
echo "Deployment completed. Checking service status..."
gcloud run services describe "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)"

# Step 7: Test the deployment
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")

echo "Testing templates endpoint..."
curl -s "$SERVICE_URL/api/v1/templates" | grep -q "templates" && \
  echo "✅ Templates endpoint is working!" || \
  echo "❌ Templates endpoint is not working!"

echo "Testing templates by ID endpoint..."
curl -s "$SERVICE_URL/api/v1/templates/boe-general" | grep -q "template" && \
  echo "✅ Template by ID endpoint is working!" || \
  echo "❌ Template by ID endpoint is not working!"

echo "Templates Service Fix deployment completed successfully!"