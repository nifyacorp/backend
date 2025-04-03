#!/bin/bash

# Script to test the subscription API fixes

# Set default values
API_URL=${API_URL:-"http://localhost:8080"}

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
  echo "ERROR: AUTH_TOKEN environment variable is not set."
  echo "Please set it before running this script:"
  echo "export AUTH_TOKEN=your_token"
  exit 1
fi

# Check if USER_ID is set
if [ -z "$USER_ID" ]; then
  echo "ERROR: USER_ID environment variable is not set."
  echo "Please set it before running this script:"
  echo "export USER_ID=your_user_id"
  exit 1
fi

echo "==== Testing Subscription API Fixes ===="
echo "API URL: $API_URL"
echo "User ID: $USER_ID"
echo "========================================="

# Run the test script
echo "Running subscription API tests..."
BASE_URL=$API_URL AUTH_TOKEN=$AUTH_TOKEN USER_ID=$USER_ID node test-subscription-api.js

# Check the exit code
if [ $? -eq 0 ]; then
  echo "✅ All tests passed!"
  echo "The subscription API fixes are working correctly."
else
  echo "❌ Some tests failed."
  echo "Please check the logs for details."
  exit 1
fi