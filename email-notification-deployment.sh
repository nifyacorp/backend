#!/bin/bash
# Email Notification Service Deployment Script

# Exit on error
set -e

# Load environment variables
source .env

# Log function for better visibility
log() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1"
}

# Check if required environment variables are set
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  log "ERROR: GOOGLE_CLOUD_PROJECT environment variable is not set"
  exit 1
fi

if [ -z "$EMAIL_SERVICE_NAME" ]; then
  EMAIL_SERVICE_NAME="email-notification-service"
  log "Using default service name: $EMAIL_SERVICE_NAME"
fi

if [ -z "$REGION" ]; then
  REGION="us-central1"
  log "Using default region: $REGION"
fi

# Step 1: Build and push the Docker image
log "Building and pushing Docker image for $EMAIL_SERVICE_NAME"
cd email-notification

# Build Docker image
log "Building Docker image..."
IMAGE_NAME="gcr.io/$GOOGLE_CLOUD_PROJECT/$EMAIL_SERVICE_NAME"
docker build -t $IMAGE_NAME .

# Push to Google Container Registry
log "Pushing image to GCR..."
docker push $IMAGE_NAME

# Step 2: Deploy to Cloud Run
log "Deploying to Cloud Run..."
gcloud run deploy $EMAIL_SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --memory 512Mi \
  --timeout 300 \
  --allow-unauthenticated \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,PORT=8080,NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $EMAIL_SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')
log "Email notification service deployed at: $SERVICE_URL"

# Step 3: Create Pub/Sub topics
log "Creating Pub/Sub topics and subscriptions..."

# Create topics (if they don't exist)
if ! gcloud pubsub topics describe email-notifications-immediate &>/dev/null; then
  log "Creating email-notifications-immediate topic..."
  gcloud pubsub topics create email-notifications-immediate
else
  log "Topic email-notifications-immediate already exists"
fi

if ! gcloud pubsub topics describe email-notifications-daily &>/dev/null; then
  log "Creating email-notifications-daily topic..."
  gcloud pubsub topics create email-notifications-daily
else
  log "Topic email-notifications-daily already exists"
fi

# Create subscriptions (if they don't exist)
if ! gcloud pubsub subscriptions describe email-notifications-immediate-sub &>/dev/null; then
  log "Creating subscription for immediate notifications..."
  gcloud pubsub subscriptions create email-notifications-immediate-sub \
    --topic=email-notifications-immediate \
    --push-endpoint="${SERVICE_URL}" \
    --ack-deadline=60
else
  log "Subscription email-notifications-immediate-sub already exists"
fi

if ! gcloud pubsub subscriptions describe email-notifications-daily-sub &>/dev/null; then
  log "Creating subscription for daily digest..."
  gcloud pubsub subscriptions create email-notifications-daily-sub \
    --topic=email-notifications-daily \
    --push-endpoint="${SERVICE_URL}/process-daily" \
    --ack-deadline=120
else
  log "Subscription email-notifications-daily-sub already exists"
fi

# Step 4: Create Cloud Scheduler job for daily digest (if it doesn't exist)
if ! gcloud scheduler jobs describe email-daily-digest &>/dev/null; then
  log "Creating Cloud Scheduler job for daily digest..."
  gcloud scheduler jobs create http email-daily-digest \
    --schedule="0 8 * * *" \
    --uri="${SERVICE_URL}/process-daily" \
    --http-method=POST \
    --time-zone="Europe/Madrid" \
    --description="Trigger daily email notification digest"
else
  log "Cloud Scheduler job email-daily-digest already exists"
fi

log "Deployment completed successfully!"
log "Service URL: $SERVICE_URL"

# Final instructions
echo ""
echo "==================================================================="
echo "Next steps:"
echo "1. Configure the following secrets in Secret Manager:"
echo "   - GMAIL_CLIENT_ID"
echo "   - GMAIL_CLIENT_SECRET"
echo "   - GMAIL_REFRESH_TOKEN"
echo ""
echo "2. Update your backend environment variables:"
echo "   EMAIL_SERVICE_URL=$SERVICE_URL"
echo "   PUBSUB_EMAIL_TOPIC=email-notifications-daily"
echo "==================================================================="