# Nifya Orchestration Service

A Node.js backend service built with Fastify for managing user subscriptions and notifications.

## 🚀 Features

- JWT-based authentication with Google Cloud Secret Manager
- Subscription management for BOE and real estate updates
- User profile creation via Google Cloud Pub/Sub
- PostgreSQL database with row-level security
- Swagger API documentation
- Structured logging throughout the application

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Fastify
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Cloud Services**:
  - Google Cloud Secret Manager (JWT secret management)
  - Google Cloud Pub/Sub (user profile events)
  - Google Cloud SQL (PostgreSQL hosting)
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Google Cloud project with:
  - Secret Manager enabled
  - Pub/Sub enabled
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
│   ├── config/           # Configuration modules
│   │   ├── auth.js       # JWT verification with Secret Manager
│   │   ├── database.js   # PostgreSQL connection pool
│   │   └── pubsub.js     # Pub/Sub event handling
│   ├── plugins/
│   │   └── auth.js       # JWT authentication middleware
│   ├── routes/
│   │   └── subscriptions.js  # Subscription management
│   ├── services/
│   │   └── users.js      # User creation handling
│   └── index.js          # Application entry point
├── supabase/
│   └── migrations/       # Database schema
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

JWT tokens are verified using Google Cloud Secret Manager.

## 🚦 API Endpoints

### Subscriptions (`/subscriptions`)
- `GET /` - List user subscriptions
  - Returns active and inactive subscriptions
  - Supports filtering by type (BOE/real estate)
  - Requires authentication

## 🔄 Event Processing

### User Creation Flow
1. Pub/Sub receives user creation event
2. Event triggers user profile creation
3. Profile stored in PostgreSQL database
4. Automatic error handling and retries

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

## 📝 Database Schema

Key tables in the current implementation:

### Users
- Profile information
- Notification preferences
- Row-level security enabled

### Subscriptions
- BOE and real estate monitoring
- User-specific settings
- Frequency configuration
- Row-level security enabled

## 📊 Monitoring

- Structured logging with timestamps
- Request/response logging
- Database query monitoring
- Pub/Sub event tracking
- Authentication attempt logging

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

## 📄 License

This project is private and confidential. All rights reserved.