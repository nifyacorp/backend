#!/bin/bash

# Script to build and deploy the backend service with version information

# Generate timestamp
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get current git commit SHA
COMMIT_SHA=$(git rev-parse HEAD)

# Generate unique deployment ID
DEPLOYMENT_ID="manual-$(date +%Y%m%d%H%M%S)"

echo "Building backend service with version information:"
echo "  Timestamp: $BUILD_TIMESTAMP"
echo "  Commit:    $COMMIT_SHA"
echo "  Deploy ID: $DEPLOYMENT_ID"

# Build the Docker image with build args
docker build \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  --build-arg COMMIT_SHA="$COMMIT_SHA" \
  --build-arg DEPLOYMENT_ID="$DEPLOYMENT_ID" \
  -t nifya-orchestration-service:latest .

echo "Docker image built successfully"

# Optional: Push to registry if needed
# docker tag nifya-orchestration-service:latest gcr.io/your-project-id/nifya-orchestration-service:latest
# docker push gcr.io/your-project-id/nifya-orchestration-service:latest

# Run container locally for testing
echo "Running container locally for testing..."
docker run --rm -p 3000:3000 nifya-orchestration-service:latest

# Output for testing
echo ""
echo "Access the version information at: http://localhost:3000/version"
echo "Access the health check at: http://localhost:3000/health"