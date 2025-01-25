# Nifya Orchestration Service

A Node.js backend service built with Fastify for managing user subscriptions and notifications.

## 🚀 Features

- Clean, domain-driven architecture
- JWT-based authentication with Google Cloud Secret Manager
- Subscription management for BOE and real estate updates
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
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Google Cloud project with:
  - Secret Manager enabled
  - Cloud SQL configured
- Environment variables configured (see `.env.example`)

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database Configuration
DB_NAME=nifya

# Server Configuration
PORT=3000
```

## 🏗 Project Structure

```
.
├── src/
│   ├── core/                    # Business logic
│   │   ├── auth/               # Authentication domain
│   │   │   └── auth.service.js
│   │   ├── subscription/       # Subscription domain
│   │   │   └── subscription.service.js
│   │   └── types/             # Domain types
│   │       ├── auth.types.js
│   │       └── subscription.types.js
│   ├── infrastructure/         # External services
│   │   └── database/
│   │       └── client.js      # Database client
│   ├── interfaces/            # External interfaces
│   │   └── http/
│   │       ├── middleware/    # HTTP middleware
│   │       │   └── auth.middleware.js
│   │       └── routes/        # Route handlers
│   │           └── subscription.routes.js
│   ├── shared/               # Shared utilities
│   │   ├── errors/          # Error handling
│   │   │   └── AppError.js
│   │   └── logging/         # Logging utilities
│   │       └── logger.js
│   └── index.js             # Application entry point
├── supabase/
│   └── migrations/          # Database schema
├── Dockerfile
└── package.json
```

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
- 24-hour secret caching with automatic rotation
- User ID validation and matching
- Structured error handling

## 🚦 API Endpoints

### Subscriptions (`/subscriptions`)
- `GET /` - List user subscriptions
  - Returns active and inactive subscriptions
  - Requires authentication
  - Includes subscription details and status

## 🏃‍♂️ Running the Service

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
docker run -p 3000:3000 nifya-orchestration-service
```

## 🔒 Security Features

- JWT verification using Google Cloud Secret Manager
- Secret rotation support (24-hour cache)
- Row-level security in PostgreSQL
- CORS protection
- Request validation via Fastify schemas
- Structured error handling

## 📝 Database Schema

### Users
- Profile information
- Row-level security enabled

### Subscriptions
- BOE and real estate monitoring
- User-specific settings
- Frequency configuration
- Row-level security enabled

## 📊 Monitoring & Logging

Structured logging throughout the application:
- Request/response logging
- Authentication events
- Error tracking
- Database operations

Each log entry includes:
- Timestamp
- Request ID
- User context (when available)
- Relevant operation details

## 🔍 Example Usage

```javascript
// Fetch subscriptions
async function fetchSubscriptions() {
  try {
    const response = await fetch('http://localhost:3000/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer your-jwt-token',
        'X-User-ID': 'your-user-id',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.subscriptions;
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    throw error;
  }
}
```

## 🧪 Error Handling

The service uses a structured error handling approach:
- Custom `AppError` class for consistent error formatting
- HTTP status codes mapping
- Detailed error information for debugging
- Error logging with context

Example error response:
```json
{
  "error": "INVALID_TOKEN",
  "message": "Invalid authentication token",
  "status": 401,
  "details": {
    "originalError": "jwt expired"
  },
  "timestamp": "2024-01-24T16:51:30.000Z"
}
```

## 📄 License

This project is private and confidential. All rights reserved.