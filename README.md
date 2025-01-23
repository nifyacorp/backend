# Nifya Orchestration Service

A Node.js microservice built with Express and TypeScript, handling orchestration and data management for the Nifya platform.

## Features

- TypeScript-based Express server
- PostgreSQL database integration with connection pooling
- Secure authentication using JWT
- Rate limiting and security middleware
- Structured logging with Pino
- Docker containerization
- Cloud Run deployment support
- Cloud SQL integration

## Authentication Service Integration

The service integrates with the authentication service at `https://authentication-service-415554190254.us-central1.run.app` which provides the following endpoints:

### Authentication Endpoints

#### User Registration and Authentication

- `POST /api/auth/signup` ⚡ - Register new users
- `POST /api/auth/login` ⚡ - Authenticate and get tokens
- `POST /api/auth/logout` ⚡ - Invalidate current session

#### Session Management

- `GET /api/auth/me` ⚡ - Get current user profile
- `POST /api/auth/refresh` ⚡ - Refresh access token
- `POST /api/auth/revoke-all-sessions` ⚡ - Logout from all devices

#### Password Management

- `POST /api/auth/forgot-password` ⚡ - Initiate password reset
- `POST /api/auth/reset-password` ⚡ - Reset password using token
- `POST /api/auth/change-password` ⚡ - Change password while logged in

#### Email Verification

- `POST /api/auth/verify-email` ⚡ - Verify email address

#### OAuth Integration

- `POST /api/auth/google/login` ⚡ - Initiate Google OAuth login
- `GET /api/auth/google/callback` ⚡ - Handle Google OAuth callback

## Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Authentication
AUTH_SERVICE_URL=http://localhost:3001
JWT_SECRET=your-32-character-secret-key-here

# Database Configuration
DB_HOST=34.31.128.250
DB_PORT=5432
DB_NAME=nifya
DB_USER=postgres
DB_PASSWORD=your-password-here
DB_INSTANCE_CONNECTION_NAME=delta-entity-447812-p2:us-central1:delta-entity-447812-db
```

## Development

### Prerequisites
- Node.js 20 or higher
- npm or yarn
- Docker (for containerization)
- Google Cloud CLI

### Google Cloud Setup

1. Enable required APIs:
   ```bash
   gcloud services enable secretmanager.googleapis.com --project=delta-entity-447812-p2
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
   # Secret Manager access
   ```bash
   gcloud projects add-iam-policy-binding delta-entity-447812-p2 \
     --member="serviceAccount:nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

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

4. Create and configure secrets:
   ```bash
   # Create secrets
   echo -n "34.31.128.250" | gcloud secrets create DB_HOST --data-file=- --project=delta-entity-447812-p2
   echo -n "5432" | gcloud secrets create DB_PORT --data-file=- --project=delta-entity-447812-p2
   echo -n "nifya" | gcloud secrets create DB_NAME --data-file=- --project=delta-entity-447812-p2
   echo -n "postgres" | gcloud secrets create DB_USER --data-file=- --project=delta-entity-447812-p2
   echo -n "your-password-here" | gcloud secrets create DB_PASSWORD --data-file=- --project=delta-entity-447812-p2
   echo -n "delta-entity-447812-p2:us-central1:delta-entity-447812-db" | \
     gcloud secrets create DB_INSTANCE_CONNECTION_NAME --data-file=- --project=delta-entity-447812-p2
   ```

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (copy `.env.example` to `.env`)
4. Start development server:
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
docker build -t nifya-orchestration .
```

## Deployment

The service is configured for deployment to Google Cloud Run using Cloud Build. The deployment process is automated through the `cloudbuild.yaml` configuration.

### Cloud Run Features
- Automatic container builds
- Cloud SQL connection
- Environment variable management
- HTTPS endpoints
- Automatic scaling
- Service account: `nifya-orchestration@delta-entity-447812-p2.iam.gserviceaccount.com`

### Required Permissions

The service account requires the following permissions:
- Secret Manager:
  - `roles/secretmanager.secretAccessor`: Access to read secrets

- Cloud SQL:
  - `roles/cloudsql.client`: Connect to Cloud SQL instances
  - `roles/cloudsql.editor`: Manage database schemas and users

- Cloud Run:
  - `roles/run.invoker`: Invoke Cloud Run services

These permissions allow the service to:
1. Read configuration from Secret Manager
2. Connect to Cloud SQL instances
3. Create and modify database schemas
4. Deploy and run on Cloud Run

## Database Schema

The service uses a PostgreSQL database with the following core tables:

- `users` - User profiles and settings
- `subscriptions` - User subscription configurations
- `notifications` - User notifications and alerts

## API Documentation

Coming soon...

## Status Icons
- ❌ Not Implemented
- ✅ Working
- ⚡ Partially Implemented (needs database integration)

## License

Proprietary - All rights reserved