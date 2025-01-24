# Nifya Orchestration Service

A Node.js microservice built with Express and TypeScript, handling orchestration and data management for the Nifya platform. The service runs on Cloud Run and connects directly to Cloud SQL using Unix domain sockets.

## Features

- TypeScript-based Express server
- Direct Cloud SQL connection via Unix domain sockets
- Cloud Run authentication integration
- Rate limiting and security middleware
- Structured logging with Pino
- Docker containerization
- Cloud Run deployment support
- Cloud SQL integration

## Cloud Run Configuration

The service is deployed to Cloud Run with the following configuration:

- Minimum instances: 1
- CPU: 1
- Memory: 512Mi
- Execution environment: Gen2
- Port: 8080
- Timeout: 300s
- Service account: `nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com`

### Database Connection

The service connects to Cloud SQL using Unix domain sockets, which provides:

1. Direct, secure connection without proxy
2. Lower latency compared to TCP connections
3. Automatic authentication using Cloud Run's service account
4. No need for external credentials or SSL certificates

The connection is established through:
- Socket path: `/cloudsql/<INSTANCE_CONNECTION_NAME>`
- Instance connection name: `delta-entity-447812-p2:us-central1:delta-entity-447812-db`

Cloud Run automatically mounts the Unix domain socket when the service is deployed with the `--add-cloudsql-instances` flag.

### Connection Pool Configuration

The database connection pool is configured for optimal performance:
- Maximum connections: 10
- Idle timeout: 30 seconds
- Connection timeout: 20 seconds
- Keep-alive enabled
- SSL disabled (not needed for Unix socket connections)

### Diagnostics

The service includes comprehensive database diagnostics that check:
1. Unix socket file accessibility
2. Connection pool creation
3. Client acquisition
4. Basic query execution
5. Server version and connection details

## Configuration

```bash
# All configuration is handled by Cloud Run
# No environment variables needed locally
```

## Development

### Prerequisites
- Node.js 20 or higher
- npm or yarn
- Docker
- Google Cloud CLI (gcloud)

### Google Cloud Setup

1. Enable required APIs:
   ```bash
   gcloud services enable cloudsql.googleapis.com --project=delta-entity-447812-p2
   gcloud services enable run.googleapis.com --project=delta-entity-447812-p2
   ```

2. Create a service account:
   ```bash
   gcloud iam service-accounts create nifya-orchestration \
     --display-name="Nifya Orchestration Service Account" \
     --project=delta-entity-447812-p2
   ```

3. Grant necessary permissions:
   ```bash
   # Cloud SQL access
   gcloud projects add-iam-policy-binding delta-entity-447812-p2 \
     --member="serviceAccount:nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com" \
     --role="roles/cloudsql.client"

   # Cloud SQL Editor (for schema management)
   gcloud projects add-iam-policy-binding delta-entity-447812-p2 \
     --member="serviceAccount:nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com" \
     --role="roles/cloudsql.editor"

   # Cloud Run Invoker
   gcloud projects add-iam-policy-binding delta-entity-447812-p2 \
     --member="serviceAccount:nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com" \
     --role="roles/run.invoker"
   ```

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

### Docker Build

```bash
docker build -t gcr.io/delta-entity-447812-p2/backend .
```

## Deployment

The service is deployed to Cloud Run using Cloud Build. The deployment process is automated through the `cloudbuild.yaml` configuration.

### Cloud Run Features
- Automatic container builds
- Direct Cloud SQL connection via Unix socket
- Automatic IAM authentication
- HTTPS endpoints
- Automatic scaling
- Service account: `nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com`

### Required Permissions

The service account requires the following permissions:
- Cloud SQL:
  - `roles/cloudsql.client`: Connect to Cloud SQL instances
  - `roles/cloudsql.editor`: Manage database schemas and users

- Cloud Run:
  - `roles/run.invoker`: Invoke Cloud Run services

### Deployment Process

The deployment is handled by Cloud Build and includes:
1. Building the Docker container
2. Pushing to Container Registry
3. Deploying to Cloud Run with Cloud SQL connection

To deploy manually:
```bash
gcloud builds submit
```

## Database Schema

The service uses a PostgreSQL database with the following core tables:

- `users` - User profiles and settings
- `subscriptions` - User subscription configurations
- `notifications` - User notifications and alerts

## API Documentation

### Health Check Endpoints

- `GET /_health` - Basic health check
- `GET /api/health` - Detailed API health status

### Authentication

Authentication is handled by Cloud Run's built-in authentication system.

## License

Proprietary - All rights reserved