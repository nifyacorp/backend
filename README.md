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
│   │   ├── auth.js       # Authentication setup
│   │   ├── database.js   # Database connection
│   │   └── pubsub.js     # Google Cloud Pub/Sub setup
│   ├── plugins/          # Fastify plugins
│   │   └── auth.js       # Authentication plugin
│   ├── routes/           # API routes
│   │   ├── auth.js       # Authentication routes
│   │   ├── health.js     # Health check endpoints
│   │   ├── notifications.js
│   │   ├── subscriptions.js
│   │   └── users.js
│   ├── services/         # Business logic
│   │   └── users.js
│   └── index.js          # Application entry point
├── supabase/
│   └── migrations/       # Database migrations
├── Dockerfile           # Container configuration
└── package.json
```

## 🚦 API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user profile

### Users
- `GET /users/:id` - Get user profile
- `PATCH /users/:id/preferences` - Update user preferences

### Subscriptions
- `GET /subscriptions` - List user subscriptions

### Notifications
- `GET /notifications/count` - Get unread notification counts
- `GET /notifications/recent` - Get recent notifications

### Health
- `GET /health` - Service health check

## 🏃‍♂️ Running the Service

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production
```bash
# Start production server
npm start
```

### Docker
```bash
# Build container
docker build -t nifya-orchestration-service .

# Run container
docker run -p 3000:3000 nifya-orchestration-service
```

## 🔒 Security

- JWT-based authentication
- Row-level security in PostgreSQL
- Secure secret management via Google Cloud Secret Manager
- CORS enabled with proper configuration

## 📝 Database Schema

### Users
- Profile information
- Notification preferences
- Row-level security enabled

### Subscriptions
- BOE and real estate monitoring
- Customizable notification frequency
- User-specific settings

### Notifications
- Real-time updates
- Read/unread status tracking
- Source URL tracking

## 🔄 Event Flow

1. User creates subscription
2. System monitors sources based on subscription settings
3. New matches trigger Pub/Sub events
4. Service processes events and creates notifications
5. Users receive updates based on their notification preferences

## 📊 Monitoring

- Detailed logging with timestamps and contextual information
- Database query performance tracking
- Connection pool monitoring
- Health check endpoint for service status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is private and confidential. All rights reserved.