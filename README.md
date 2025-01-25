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
DB_USER=nifya
DB_PASSWORD=your-password-here

# Server Configuration
PORT=3000
SERVICE_URL=your-cloud-run-url

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
INSTANCE_CONNECTION_NAME=your-instance-connection
JWT_SECRET_NAME=projects/your-project/secrets/JWT_SECRET/versions/latest
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
│   │   ├── logging/         # Logging utilities
│   │   │   └── logger.js
│   │   └── utils/          # Utility functions
│   │       └── env.js
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
  - Requires authentication
  - Returns active and inactive subscriptions
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
- Structured authentication middleware
- Public endpoints whitelist
- Row-level security in PostgreSQL
- CORS protection
- Request validation via Fastify schemas
- Comprehensive error handling

## 📝 Database Schema

### Users
- Basic info: id, email, name
- Preferences: theme, language, avatar, bio
- Notification settings
- Security: Row-level protection

### Subscriptions
- Flexible type system (built-in + custom)
- Maximum 3 prompts per subscription
- Frequency options: immediate/daily
- Active status tracking
- Type-specific metadata
- Security: Row-level protection

### Subscription Types
- System types (BOE, Real Estate)
- Custom user-defined types
- Icon support (lucide-react)
- Security: System/user separation

## 📊 Monitoring & Logging

Structured logging throughout the application:
- Request/response logging via `logger.js`
- Authentication events
- Error tracking with stack traces
- Database operations
- Environment validation

Each log entry includes:
- Timestamp
- Request ID
- User context (when available)
- Relevant operation details

## 🔍 Example Usage

### Fetch Subscription Types
```javascript
const response = await fetch('http://localhost:3000/subscriptions/types', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId
  }
});

const data = await response.json();
// Returns: { types: [{ id, name, description, icon, isSystem, ... }] }
```

### Create Custom Type
```javascript
const response = await fetch('http://localhost:3000/subscriptions/types', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Custom Alerts',
    description: 'My custom alert type',
    icon: 'Bell'
  })
});
```

### Create Subscription
```javascript
const response = await fetch('http://localhost:3000/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    typeId: 'subscription-type-id',
    name: 'My Subscription',
    description: 'Custom alerts for specific topics',
    prompts: ['topic 1', 'topic 2'],
    frequency: 'daily'
  })
});
```

### Fetch User Subscriptions
```javascript
const response = await fetch('http://localhost:3000/subscriptions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId
  }
});

const data = await response.json();
// Returns: { subscriptions: [{ id, name, type, prompts, ... }] }
```

## 🔒 Security Features

- JWT verification using Google Cloud Secret Manager
- Structured authentication middleware
- Public endpoints whitelist
- Row-level security in PostgreSQL:
  - Users can only access their own data
  - System subscription types are protected
  - Custom types are user-scoped

## 📝 API Endpoints

### Authentication Required

#### Subscription Types
- `GET /subscriptions/types` - List available types
- `POST /subscriptions/types` - Create custom type

#### Subscriptions
- `GET /subscriptions` - List user subscriptions
- `POST /subscriptions` - Create subscription

#### User Profile
- `GET /api/users/me` - Get user profile
- `PATCH /api/users/me` - Update user profile

### Public Endpoints
- `GET /health` - Service health check
- `GET /documentation` - API documentation

## 🧪 Error Handling

Structured error responses with consistent format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "status": 400,
  "details": {
    "additionalInfo": "..."
  },
  "timestamp": "2024-01-25T16:51:30.000Z"
}
```

Common error scenarios:
- Invalid authentication
- Subscription type not found
- Maximum prompts exceeded
- Invalid subscription parameters

## 🚀 Running the Service

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

## 📊 Monitoring & Logging

Structured logging throughout the application:
- Request/response logging
- Authentication events
- Error tracking with stack traces
- Database operations
- Environment validation

Each log entry includes:
- Timestamp
- Request ID
- User context (when available)
- Relevant operation details

## 🔐 Environment Setup

Required environment variables:
```bash
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
```

## 📄 License

This project is private and confidential. All rights reserved.
  try {
    const response = await fetch('http://localhost:3000/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
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
    "originalError": "invalid signature"
  },
  "timestamp": "2024-01-25T16:51:30.000Z"
}
```

## 📄 License

This project is private and confidential. All rights reserved.