#!/bin/bash

# Script to run all subscription API tests

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

echo "==== Running Subscription API Tests ===="
echo "API URL: $API_URL"
echo "User ID: $USER_ID"
echo "========================================="

# Run the basic subscription API tests
echo "🧪 Running basic subscription API tests..."
BASE_URL=$API_URL AUTH_TOKEN=$AUTH_TOKEN USER_ID=$USER_ID node test-subscription-api.js

# Check the exit code
if [ $? -ne 0 ]; then
  echo "❌ Basic subscription API tests failed."
  echo "Please fix these issues before continuing."
  exit 1
fi

echo ""
echo "==== Basic Subscription API Tests Passed ===="
echo ""

# Run the enhanced filtering and pagination tests
echo "🧪 Running enhanced filtering and pagination tests..."
BASE_URL=$API_URL AUTH_TOKEN=$AUTH_TOKEN USER_ID=$USER_ID node test-subscription-filters.js

# Check the exit code
if [ $? -ne 0 ]; then
  echo "❌ Enhanced filtering and pagination tests failed."
  exit 1
fi

echo ""
echo "==== All Subscription API Tests Passed! ===="
echo "✅ The subscription API is working correctly with all fixes and enhancements."
echo ""