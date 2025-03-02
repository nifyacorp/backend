# Nifya Orchestration Service

A Node.js backend service built with Fastify for managing flexible user subscriptions and notifications.

## 🚀 Features

- Clean, domain-driven architecture
- JWT-based authentication with Google Cloud Secret Manager
- Flexible subscription system:
  - Built-in types (BOE, Real Estate)
  - Custom user-defined types
  - Up to 3 prompts per subscription
  - Immediate or daily frequency options
  - Template system with built-in and user templates
- Comprehensive notification management:
  - User-specific notifications
  - Read/unread tracking
  - Subscription filtering
  - Pagination support
  - Bulk operations (mark all as read, delete all)
- Structured error handling and logging
- PostgreSQL database with row-level security
- Swagger API documentation
- REST API with standardized headers

## 🔄 Integration with NIFYA Ecosystem

This service functions as the central orchestration layer in the NIFYA ecosystem, connecting various components:

### Authentication Integration
- Verifies JWT tokens from the Authentication Service
- Uses standardized headers:
  - `Authorization`: Bearer token for JWT validation
  - `X-User-ID`: User identifier for request authorization
  - `X-Request-ID`: For cross-service request tracing

### Worker Services Integration
- Publishes events to Google Cloud Pub/Sub for asynchronous processing
- Topics:
  - `subscription-created`: Triggers initial processing of new subscriptions
  - `subscription-updated`: Notifies of changes to subscription parameters
  - `notification-created`: Alerts email service for delivery
- External Services:
  - Subscription Worker: `https://subscription-worker-415554190254.us-central1.run.app`
  - DOGA Parser: `https://doga-parser-415554190254.us-central1.run.app`

### Frontend Integration
- Provides RESTful API endpoints for frontend applications
- Structured responses with consistent error handling
- Pagination support for listing resources

### Database Integration
- PostgreSQL with row-level security for data isolation
- Entity relationships:
  - Users → Subscriptions → Notifications
  - Subscription Types & Templates
  - Activity Logs & Feedback

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Fastify
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Cloud Services**:
  - Google Cloud Secret Manager (JWT secret management)
  - Google Cloud SQL (PostgreSQL hosting)
  - Google Cloud Run (Backend hosting)
  - Google Cloud Pub/Sub (Event handling)
- **Documentation**: Swagger/OpenAPI
- **Validation**: Fastify schema validation
- **Security**: CORS, Row-Level Security (RLS)

## 🌐 Project Structure

```
.
├── src/
│   ├── core/                    # Business logic
│   │   ├── auth/                # Authentication domain
│   │   │   └── auth.service.js
│   │   ├── notification/        # Notification domain
│   │   │   ├── data/            # Data access
│   │   │   │   └── notification-repository.js
│   │   │   ├── interfaces/      # Interface adapters
│   │   │   │   └── http/
│   │   │   │       └── notification-controller.js
│   │   │   └── notification-service.js
│   │   ├── subscription/        # Subscription domain
│   │   │   ├── data/            # Static data
│   │   │   │   └── built-in-templates.js
│   │   │   ├── services/        # Domain services
│   │   │   │   ├── subscription.service.js
│   │   │   │   ├── template.service.js
│   │   │   │   └── type.service.js
│   │   │   ├── types/           # Domain types
│   │   │   │   └── subscription.types.js
│   │   │   └── index.js         # Domain exports
│   │   └── user/                # User domain
│   │       └── user.service.js
│   ├── infrastructure/          # External services
│   │   ├── database/
│   │   │   ├── client.js        # Database client
│   │   │   └── migrations.js    # Migration system
│   │   └── pubsub/
│   │       └── client.js        # Pub/Sub client
│   ├── interfaces/              # External interfaces
│   │   └── http/
│   │       ├── middleware/      # HTTP middleware
│   │       │   └── auth.middleware.js
│   │       └── routes/          # Route handlers
│   │           ├── notification.routes.js
│   │           ├── subscription.routes.js
│   │           ├── template.routes.js
│   │           └── user.routes.js
│   ├── shared/                  # Shared utilities
│   │   ├── constants/           # Shared constants
│   │   │   └── headers.js
│   │   ├── errors/              # Error handling
│   │   │   └── AppError.js
│   │   ├── logging/             # Logging utilities
│   │   │   └── logger.js
│   │   └── utils/               # Utility functions
│   │       └── env.js
│   └── index.js                 # Application entry point
├── supabase/
│   └── migrations/              # Database schema
│       ├── 20250130114438_late_beacon.sql  # Core schema
│       ├── 20250130154752_pale_gate.sql    # Additional tables
│       └── 20250130170506_raspy_gate.sql   # Schema updates
├── Dockerfile
├── package.json
└── package-lock.json
```

## 📊 Database Schema

The service uses a PostgreSQL database with the following key tables:

### Core Tables
- **users**: Core user data with preferences and notification settings
- **subscription_types**: System and custom subscription categories
- **subscriptions**: User subscriptions with prompts and frequency settings
- **notifications**: Messages generated for users based on subscriptions
- **subscription_templates**: Reusable subscription configurations

### Supporting Tables
- **activity_logs**: User activity tracking for analytics
- **feedback**: User feedback on notifications for quality improvement
- **subscription_processing**: Processing status tracking for subscriptions

### Security Features
- Row Level Security (RLS) on all tables
- Role-based access policies
- User-scoped data access
- System data protection

## 🚦 API Endpoints

### Health Check
- `GET /health` - Service health status
  - Public endpoint
  - Returns service status and timestamp

### Diagnostics
- `GET /api/v1/diagnostics/database` - Database connection diagnostics
  - Requires `userId` query parameter
  - Tests RLS context functionality

### Notifications
- `GET /api/v1/notifications` - List user notifications (with pagination/filters)
- `POST /api/v1/notifications/:notificationId/read` - Mark notification as read
- `POST /api/v1/notifications/read-all` - Mark all notifications as read
- `DELETE /api/v1/notifications/:notificationId` - Delete notification
- `DELETE /api/v1/notifications/delete-all` - Delete all notifications

### Subscriptions
- `GET /api/v1/subscriptions` - List user subscriptions
- `POST /api/v1/subscriptions` - Create subscription
- `GET /api/v1/subscriptions/:id` - Get subscription details
- `PATCH /api/v1/subscriptions/:id` - Update subscription
- `DELETE /api/v1/subscriptions/:id` - Delete subscription
- `GET /api/v1/subscriptions/types` - List subscription types

### Templates
- `GET /api/v1/templates` - List subscription templates (public)
- `GET /api/v1/templates/:id` - Get template details (public)
- `POST /api/v1/templates/:id/subscribe` - Create subscription from template (protected)

### Users
- `GET /api/v1/users/me` - Get user profile
- `PATCH /api/v1/users/me` - Update user profile

## 🔑 Authentication

Protected endpoints require:
1. JWT token in Authorization header:
   ```
   Authorization: Bearer <token>
   ```
2. User ID in custom header:
   ```
   X-User-ID: <user-id>
   ```

Features:
- JWT verification using Google Cloud Secret Manager
- Token signature validation
- User ID validation and matching
- Structured error handling

## 🏃‍♂️ Running the Service

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here
DB_HOST=localhost
DB_PORT=5432

# Google Cloud Configuration (Production)
GOOGLE_CLOUD_PROJECT=your-project-id
INSTANCE_CONNECTION_NAME=your-instance-connection

# JWT Configuration
JWT_SECRET_NAME=nifya-jwt-secret  # Secret name in Secret Manager
JWT_ISSUER=nifya-auth-service

# Service Configuration
PORT=3000
NODE_ENV=development  # Set to "production" for production environment
SERVICE_URL=localhost:3000  # Used for documentation
```

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm install --production
npm start
```

### Docker
```bash
docker build -t nifya-orchestration-service .
docker run -p 3000:3000 --env-file .env nifya-orchestration-service
```

## ☁️ Cloud Deployment

### Google Cloud Setup

1. Enable required APIs:
   ```bash
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable pubsub.googleapis.com
   ```

2. Create service account:
   ```bash
   gcloud iam service-accounts create nifya-backend-sa --display-name="Nifya Backend Service Account"
   ```

3. Grant permissions:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:nifya-backend-sa@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:nifya-backend-sa@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/pubsub.publisher"
   ```

### Deploy to Cloud Run

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/nifya-backend

# Deploy service
gcloud run deploy nifya-backend \
  --image gcr.io/PROJECT_ID/nifya-backend \
  --platform managed \
  --region us-central1 \
  --service-account nifya-backend-sa@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "NODE_ENV=production,JWT_SECRET_NAME=nifya-jwt-secret,JWT_ISSUER=nifya-auth-service" \
  --set-secrets "DB_PASSWORD=projects/PROJECT_NUMBER/secrets/nifya-db-password/versions/latest" \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME
```

## 🔒 Security Features

- JWT verification using Google Cloud Secret Manager
- Authentication middleware with:
  - JWT token validation
  - User ID verification
  - Token signature validation
- Row-level security in PostgreSQL:
  - Users can only access their own data
  - System subscription types are protected
  - Custom types are user-scoped
- CORS protection with configurable origins
- Request/response validation via Fastify schemas
- Structured error handling with detailed responses
- Protection against JSON prototype pollution

### Recent Row-Level Security Fixes

In February-March 2025, we implemented fixes to resolve issues with Row-Level Security context handling:

1. Updated `setRLSContext` and `withRLSContext` functions to properly handle PostgreSQL's requirement for literal values in `SET LOCAL` commands
2. Added proper UUID validation to prevent SQL injection
3. Ensured all notification repository functions set the RLS context before executing database queries

These fixes ensure notifications are correctly scoped to their owners and can be retrieved properly through the API. For detailed information, see the [RLS-FIXES.md](./RLS-FIXES.md) file.

## 📊 Monitoring & Logging

Structured logging throughout the application:
- Request/response logging
- Authentication events
- Error tracking with stack traces
- Database operations
- Environment validation
- Pub/Sub events

Each log entry includes:
- Timestamp
- Request ID
- User context (when available)
- Relevant operation details
- Context keys (service, method, etc.)

### Recommended Monitoring Metrics

- **Request Volume**: Total number of requests handled
- **Response Time**: Average and p95/p99 response times
- **Error Rate**: Percentage of requests resulting in errors (4xx/5xx)
- **Database Query Latency**: Time taken to execute database queries
- **Active Users**: Count of distinct users making requests
- **Subscription Creation Rate**: New subscriptions created over time
- **Notification Volume**: Number of notifications generated

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Errors
- Check database credentials
- Verify Cloud SQL instance is running
- Ensure network connectivity to database
- Check for max connections limit
- Verify proper RLS context setup

#### Authentication Issues
- Verify JWT secret is correctly configured in Secret Manager
- Check that the service account has access to Secret Manager
- Confirm token generation and validation flow
- Check token expiration times

#### Subscription Processing
- Check Pub/Sub topic and subscription configuration
- Verify worker services are running
- Check for errors in the `subscription_processing` table
- Validate message format in Pub/Sub topics

#### 500 Internal Server Errors
- Check for PostgreSQL syntax errors, especially in RLS context setting
- Verify environment variables are correctly set
- Review application logs for detailed error messages
- Check for memory/CPU limits being reached

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Manual Testing

Use the diagnostic endpoints to verify system functionality:

```bash
# Test database connection with RLS
curl "http://localhost:3000/api/v1/diagnostics/database?userId=YOUR_UUID_HERE"

# Health check
curl http://localhost:3000/health
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -am 'Add new feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Create a new Pull Request

### Code Style Guide

- Follow the existing code style
- Use ESLint for code linting
- Document new functions and components
- Write unit tests for new functionality

## 📝 Version History

### v1.0.0 (March 2025)
- Initial production release
- Complete notification and subscription management
- JWT authentication integration
- PostgreSQL with Row-Level Security

### v0.9.0 (February 2025)
- Beta release with core functionality
- Fixed RLS context handling issues
- Added comprehensive error handling
- Improved logging and diagnostics

## 📄 License

This project is private and confidential. All rights reserved.