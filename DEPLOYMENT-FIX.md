# Backend Deployment Fix

## Issue
The backend deployment to Cloud Run was failing with the following error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'fastify-express' imported from /usr/src/app/src/index.js
```

## Root Cause
The backend code was referencing `fastify-express` package, but this package has been renamed to `@fastify/express` in newer versions of Fastify (v4+). The package was not installed in the container, and the import path was incorrect.

## Fixes Applied

1. **Updated package.json**:
   - Added `@fastify/express` to the dependencies:
     ```json
     "@fastify/express": "^2.3.0",
     ```

2. **Updated import statement**:
   - Changed the import in `src/index.js` from:
     ```javascript
     import express from 'fastify-express';
     ```
     to:
     ```javascript
     import express from '@fastify/express';
     ```

3. **Updated Dockerfile**:
   - Added explicit installation of `@fastify/express` to ensure it's included:
     ```dockerfile
     RUN npm install --no-audit --no-fund && \
         npm install @fastify/express && \
         npm prune --production && \
         npm cache clean --force
     ```

4. **Created update script**:
   - Added `update-dependencies.sh` to make it easy to update dependencies locally

## How to Deploy

1. Pull the latest changes:
   ```bash
   git pull
   ```

2. Update dependencies:
   ```bash
   cd backend
   ./update-dependencies.sh
   ```

3. Deploy to Cloud Run:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

## Verification

After deployment, verify these points:

1. The service is running successfully in Cloud Run
2. The diagnostics endpoints are accessible:
   - `/api/diagnostics/health`
   - `/api/v1/diagnostics/health`

3. Use the test script to verify all functionality:
   ```bash
   node post-fix-test.js
   ```