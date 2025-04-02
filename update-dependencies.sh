#!/bin/bash
# Update dependencies and reinstall

echo "Installing @fastify/express..."
npm install @fastify/express

echo "Verifying package installation..."
if grep -q "@fastify/express" package.json; then
  echo "✅ @fastify/express is in package.json"
else
  echo "❌ @fastify/express is missing from package.json"
  exit 1
fi

echo "Checking node_modules..."
if [ -d "node_modules/@fastify/express" ]; then
  echo "✅ @fastify/express is installed in node_modules"
else
  echo "❌ @fastify/express is missing from node_modules"
  echo "Running full npm install..."
  npm install
fi

echo "Dependencies updated successfully. Ready to deploy."