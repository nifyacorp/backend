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
- Structured error handling and logging
- PostgreSQL database with row-level security
- Swagger API documentation

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

## 🌐 Deployment Information

### Backend Service
- **URL**: `https://backend-415554190254.us-central1.run.app`
- **Service Name**: `backend`
- **Service Account**: 
  - Deploy: `415554190254-compute@developer.gserviceaccount.com`
  - Runtime: `backend@delta-entity-447812-p2.iam.gserviceaccount.com`
- **Region**: `us-central1`

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Google Cloud project with:
  - Secret Manager enabled
  - Cloud SQL configured
  - Cloud Pub/Sub enabled
- Environment variables configured (see `.env.example`)

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

\`\`\`bash
# Database Configuration
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here

# Server Configuration
PORT=3000
SERVICE_URL=your-cloud-run-url

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
INSTANCE_CONNECTION_NAME=your-instance-connection
JWT_SECRET_NAME=projects/your-project/secrets/JWT_SECRET/versions/latest
\`\`\`

## 🏗 Project Structure

\`\`\`
.
├── src/
│   ├── core/                    # Business logic
│   │   ├── auth/               # Authentication domain
│   │   │   └── auth.service.js
│   │   ├── subscription/       # Subscription domain
│   │   │   ├── data/          # Static data
│   │   │   │   └── built-in-templates.js
│   │   │   ├── services/      # Domain services
│   │   │   │   ├── subscription.service.js
│   │   │   │   ├── template.service.js
│   │   │   │   └── type.service.js
│   │   │   ├── types/         # Domain types
│   │   │   │   └── subscription.types.js
│   │   │   └── index.js       # Domain exports
│   │   └── user/              # User domain
│   │       └── user.service.js
│   ├── infrastructure/         # External services
│   │   ├── database/
│   │   │   ├── client.js      # Database client
│   │   │   └── migrations.js   # Migration system
│   │   └── pubsub/
│   │       └── client.js      # Pub/Sub client
│   ├── interfaces/            # External interfaces
│   │   └── http/
│   │       ├── middleware/    # HTTP middleware
│   │       │   └── auth.middleware.js
│   │       └── routes/        # Route handlers
│   │           ├── subscription.routes.js
│   │           ├── template.routes.js
│   │           └── user.routes.js
│   ├── shared/               # Shared utilities
│   │   ├── errors/          # Error handling
│   │   │   └── AppError.js
│   │   ├── logging/         # Logging utilities
│   │   │   └── logger.js
│   │   └── utils/          # Utility functions
│   │       └── env.js
│   └── index.js             # Application entry point
├── supabase/
│   └── migrations/          # Database schema
├── Dockerfile
└── package.json
\`\`\`

## 🔑 Authentication

Protected endpoints require:
1. JWT token in Authorization header:
   \`\`\`
   Authorization: Bearer <token>
   \`\`\`
2. User ID in custom header:
   \`\`\`
   X-User-ID: <user-id>
   \`\`\`

Features:
- JWT verification using Google Cloud Secret Manager
- Token signature validation
- User ID validation and matching
- Structured error handling

## 🚦 API Endpoints

### Health Check
- `GET /health` - Service health status
  - Public endpoint
  - Returns service status and timestamp

### Subscriptions
- `GET /subscriptions` - List user subscriptions
- `POST /subscriptions` - Create subscription
- `GET /subscriptions/:id` - Get subscription details
- `PATCH /subscriptions/:id` - Update subscription
- `DELETE /subscriptions/:id` - Delete subscription

### Templates
- `GET /templates` - List subscription templates (public)
- `GET /templates/:id` - Get template details (public)
- `POST /templates/:id/subscribe` - Create subscription from template (protected)

### Users
- `GET /users/me` - Get user profile
- `PATCH /users/me` - Update user profile

## 🏃‍♂️ Running the Service

### Development
\`\`\`bash
npm install
npm run dev
\`\`\`

### Production
\`\`\`bash
npm install --production
npm start
\`\`\`

### Docker
\`\`\`bash
docker build -t nifya-orchestration-service .
docker run -p 3000:3000 nifya-orchestration-service
\`\`\`

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

## 📄 License

This project is private and confidential. All rights reserved.