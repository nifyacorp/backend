# Version Tracking and Health Monitoring

This document describes the version tracking and health monitoring implementation for the NIFYA Orchestration Service.

## Endpoints

The service provides two main endpoints for monitoring:

### 1. `/health` - Health Check Endpoint

This endpoint provides basic health information about the service, including:

- Current service status
- Current timestamp
- Server uptime
- Version information
- Memory usage statistics
- Service dependencies status

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-03-23T15:30:45Z",
  "uptime": 3600,
  "version": {
    "package": "1.0.0",
    "buildTimestamp": "2025-03-23T14:00:00Z", 
    "commitSha": "abc123def456",
    "environment": "production"
  },
  "memory": {
    "rss": 65536000,
    "heapTotal": 32768000,
    "heapUsed": 16384000
  },
  "services": {
    "database": "connected"
  }
}
```

### 2. `/version` - Version Information Endpoint

This endpoint provides detailed version and build information for deployment tracking:

- API version
- Service name
- Package version
- Build details (timestamp, git commit, deployment ID)
- Environment
- Enabled features
- Server uptime (in seconds and formatted)

**Example Response:**

```json
{
  "api_version": "v1",
  "service": "nifya-orchestration-service", 
  "version": "1.0.0",
  "build": {
    "timestamp": "2025-03-23T14:00:00Z",
    "commit": "abc123def456",
    "deployment_id": "cloud-run-123456"
  },
  "environment": "production",
  "features": {
    "notifications": true,
    "subscriptions": true,
    "templates": true
  },
  "uptime_seconds": 3600,
  "uptime_formatted": "1h"
}
```

## Deployment

The service is configured to include version information during build and deployment:

1. **Build Arguments**: The Dockerfile accepts build arguments that are passed during build time:
   - `BUILD_TIMESTAMP`: When the image was built (ISO format)
   - `COMMIT_SHA`: Git commit SHA of the deployed code
   - `DEPLOYMENT_ID`: Unique identifier for the deployment

2. **Environment Variables**: These build arguments are converted to environment variables in the container.

3. **Cloud Build Integration**: The cloudbuild.yaml configuration passes these values automatically during CI/CD pipelines.

## Local Testing

You can test the version tracking locally using the provided script:

```bash
./deploy-with-version.sh
```

This script:
1. Captures the current git commit SHA
2. Generates a timestamp and deployment ID
3. Builds a Docker image with these values
4. Runs the container locally for testing

After running the script, you can access:
- http://localhost:3000/health
- http://localhost:3000/version

## Monitoring

The health endpoint is configured as a Docker HEALTHCHECK, which allows Docker to monitor the container's health status. Cloud Run will also use this endpoint to determine if the service is healthy.

For more comprehensive monitoring, consider integrating with Cloud Monitoring and setting up alerts based on the health endpoint's response.