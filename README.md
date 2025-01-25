# Nifya Orchestration Service

A Node.js backend service built with Fastify for managing user subscriptions and notifications.

## 🚀 Features

- User authentication and profile management
- Subscription management for BOE and real estate updates
- Real-time notifications via Google Cloud Pub/Sub
- PostgreSQL database with row-level security
- Swagger API documentation
- Health monitoring endpoints

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Cloud Services**:
  - Google Cloud Pub/Sub
  - Google Cloud Secret Manager
  - Google Cloud SQL
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Google Cloud project with required services enabled
- Environment variables configured (see `.env.example`)

## 🔧 Configuration

Copy `.env.example` to `.env` and configure the following variables:

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
│   │   ├── auth.js       # JWT verification and Secret Manager integration
│   │   ├── database.js   # PostgreSQL connection and query handling
│   │   └── pubsub.js     # Google Cloud Pub/Sub event handling
│   ├── plugins/          # Fastify plugins
│   │   └── auth.js       # JWT authentication middleware
│   ├── routes/           # API routes
│   │   ├── auth.js       # Authentication routes
│   │   ├── health.js     # Health check endpoints
│   │   ├── notifications.js  # Notification management
│   │   ├── subscriptions.js  # Subscription handling
│   │   └── users.js         # User profile management
│   ├── services/         # Business logic
│   │   └── users.js      # User-related business logic
│   └── index.js          # Server initialization and route setup
├── supabase/migrations/  # PostgreSQL schema migrations
├── Dockerfile           # Container configuration
├── package.json         # Project dependencies and scripts
└── .env.example         # Environment variable template
```

## 🔑 Authentication

All protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

The JWT token is verified using Google Cloud Secret Manager for secure key management.

## 🚦 API Endpoints

### Authentication (`/api/auth`)
- `GET /me` - Get current user profile

### Users (`/users`)
- `GET /:id` - Get user profile
- `PATCH /:id/preferences` - Update user preferences

### Subscriptions (`/subscriptions`)
- `GET /` - List user subscriptions

### Notifications (`/notifications`)
- `GET /count` - Get unread notification counts
- `GET /recent` - Get recent notifications

### Health (`/health`)
- `GET /` - Service health check

## 🏃‍♂️ Running the Service

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Configure required variables

3. Start the service:
   - Development: `npm run dev`
   - Production: `npm start`
   - Docker: `docker build -t nifya-orchestration-service . && docker run -p 3000:3000 nifya-orchestration-service`

## 🔒 Security

- JWT authentication using Google Cloud Secret Manager
- PostgreSQL with row-level security
- CORS protection
- Request validation using Fastify schemas

## 📝 Database Schema

The database schema is managed through migrations in `supabase/migrations/`:
- `users`: User profiles and preferences
- `subscriptions`: BOE and real estate monitoring settings
- `notifications`: User notification management
- `activity_logs`: User action tracking
- `subscription_templates`: Reusable subscription configurations
- `feedback`: User feedback on notifications

## 🔄 Event Flow

1. Authentication via JWT
2. Subscription management through REST API
3. Real-time updates via Google Cloud Pub/Sub
4. Notification delivery based on user preferences

## 📊 Monitoring

- Structured logging with timestamps
- Database query monitoring
- Connection pool stats
- Health checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is private and confidential. All rights reserved.