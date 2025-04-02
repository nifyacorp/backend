#!/bin/bash
# Script to run database diagnostics and user synchronization tests

# Check if required environment variables are set
if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ AUTH_TOKEN environment variable is required"
  echo "Example: export AUTH_TOKEN='your_jwt_token'"
  exit 1
fi

if [ -z "$USER_ID" ]; then
  echo "❌ USER_ID environment variable is required"
  echo "Example: export USER_ID='your_user_id'"
  exit 1
fi

# Set default base URL if not provided
if [ -z "$BASE_URL" ]; then
  export BASE_URL='http://localhost:3000'
  echo "ℹ️ Using default BASE_URL: $BASE_URL"
fi

echo "🧪 Running diagnostics tests..."
echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo "Auth Token: ${AUTH_TOKEN:0:10}...${AUTH_TOKEN: -5} (truncated for security)"

# Run the diagnostic test script
node test-diagnostics.js

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Diagnostics completed successfully"
  exit 0
else
  echo "❌ Diagnostics failed"
  exit 1
fi