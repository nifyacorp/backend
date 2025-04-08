# NIFYA Backend Orchestration Service

A comprehensive API backend designed for LLM-powered notification and subscription management, orchestrating content processing across multiple AI models.

## 🧠 Key Features

- **Multi-Model Orchestration**: Routes processing tasks to specialized LLMs based on content type
- **Subscription Management**: Complete CRUD operations for user subscriptions
- **Notification System**: Generates and delivers personalized notifications
- **Real-time Updates**: Socket.IO integration for instant notification delivery
- **User Synchronization**: Automatic synchronization between authentication and backend systems
- **Secure API**: JWT authentication with robust permission controls
- **Structured Data Processing**: Transforms unstructured content into standardized notification formats

## 📊 Architecture Overview

```
┌─────────────────────┐     ┌────────────────┐     ┌───────────────────┐
│ Content Sources     │     │ LLM Processing │     │ User Interface    │
├─────────────────────┤     ├────────────────┤     ├───────────────────┤
│ ● BOE Documents     │     │ ● OpenAI       │     │ ● React Frontend  │
│ ● Real Estate Data  │◄───►│ ● Gemini       │◄───►│ ● Mobile Apps     │
│ ● DOGA Publications │     │ ● Claude       │     │ ● Email Digest    │
└─────────────────────┘     └────────────────┘     └───────────────────┘
           ▲                        ▲                        ▲
           │                        │                        │
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NIFYA Backend Orchestration Layer                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │ Auth Service   │   │ Subscription Mgmt │   │ Notification Mgmt  │ │
│  └────────────────┘   └──────────────────┘   └────────────────────┘ │
│                                                                      │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │ Neural Router  │   │ Prompt Templates │   │ Response Formatter │ │
│  └────────────────┘   └──────────────────┘   └────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL + Vector Database                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Core Components

### Auth Middleware
(`src/interfaces/http/middleware/auth.middleware.js`)

Handles JWT verification and user synchronization:

```javascript
/**
 * Authenticates requests using JWT tokens
 * Also synchronizes users between auth service and database
 */
export async function authenticate(request, reply) {
  // Verify JWT token
  // Extract user information
  // Synchronize user to database if they don't exist
  // Set user context for downstream handlers
}

/**
 * Synchronizes user from auth token to database
 * Creates user record if it doesn't exist
 */
async function synchronizeUser(userId, userInfo, context) {
  // Check if user exists in database
  // If not, create user with info from JWT token
  // Sets default preferences
}
```

### Subscription Service
(`src/core/subscription/services/subscription.service.js`)

Manages all subscription operations:

```javascript
/**
 * Creates a new subscription
 * @param {Object} data - Subscription data with type, name, prompts
 * @param {String} userId - User ID from auth
 * @returns {Promise<Object>} Created subscription
 */
async function createSubscription(data, userId) {
  // Validate input
  // Handle special types
  // Insert to database
  // Return created subscription
}

/**
 * Processes a subscription
 * @param {String} id - Subscription ID
 * @param {String} userId - User ID from auth
 * @returns {Promise<Object>} Processing result
 */
async function processSubscription(id, userId) {
  // Verify ownership
  // Update status
  // Publish processing request
  // Return processing information
}
```

### Notification Service
(`src/core/notification/service/notification-service.js`)

Manages notifications:

```javascript
/**
 * Retrieves notifications for a user
 * @param {Object} query - Filter parameters
 * @param {String} userId - User ID from auth
 * @returns {Promise<Array>} List of notifications
 */
async function getNotifications(query, userId) {
  // Apply filters
  // Format for client
  // Return sorted notifications
}

/**
 * Creates a notification
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(data) {
  // Validate input
  // Insert to database
  // Emit real-time event
  // Return created notification
}
```

### Database Client
(`src/infrastructure/database/client.js`)

Manages database connections and queries:

```javascript
/**
 * Executes a database query
 * @param {String} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
  // Get client from pool
  // Execute query
  // Release client
  // Return result
}
```

## 🔑 API Endpoints

For a comprehensive list of all available API endpoints, please refer to the [ENDPOINTS.md](./ENDPOINTS.md) file.

### Authentication

All authenticated routes require:
- `Authorization: Bearer <token>` header
- `X-User-ID: <user-id>` header

## 📦 Data Models

### Subscription Model

```javascript
/**
 * Subscription object structure
 * @typedef {Object} Subscription
 * @property {string} id - UUID
 * @property {string} user_id - User UUID
 * @property {string} name - Subscription name
 * @property {string} description - Optional description
 * @property {string} type - Subscription type (e.g., "BOE", "real-estate")
 * @property {Array<string>} prompts - List of user prompts (1-3)
 * @property {string} status - Current status
 * @property {Object} metadata - Additional data
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */
```

### Notification Model

```javascript
/**
 * Notification object structure
 * @typedef {Object} Notification
 * @property {string} id - UUID
 * @property {string} user_id - User UUID
 * @property {string} subscription_id - Related subscription UUID
 * @property {string} title - Notification title
 * @property {string} content - Notification content
 * @property {string} source_url - Original content URL
 * @property {boolean} read - Read status
 * @property {Object} metadata - Additional data
 * @property {Date} created_at - Creation timestamp
 */
```

### User Model

```javascript
/**
 * User object structure
 * @typedef {Object} User
 * @property {string} id - UUID
 * @property {string} email - User email
 * @property {string} name - Display name
 * @property {Object} preferences - User preferences
 * @property {Object} notification_settings - Notification settings
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */
```

## 🧰 Development Guide

### Environment Setup

Create a `.env` file with:

```env
# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/nifya

# JWT configuration
JWT_SECRET=your-secret-key

# Server configuration
PORT=3000
NODE_ENV=development

# PubSub configuration (optional)
PUBSUB_PROJECT_ID=your-project-id
PUBSUB_SUBSCRIPTION_TOPIC=subscription-processing
```

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

### Database Migrations

Database schema is managed through SQL migrations in the `supabase/migrations` directory. To apply migrations:

```bash
# Apply all migrations
npm run migrate

# Create a new migration
npm run migrate:create migration_name
```

## 🔧 Key Files and Their Functions

### Core Configuration

- `src/index.js`: Main application entry point and server setup
- `src/infrastructure/database/client.js`: Database connection and query handling
- `src/core/auth/auth.service.js`: Authentication service and JWT handling

### API Routes

- `src/interfaces/http/routes/subscription/crud.routes.js`: Subscription CRUD routes
- `src/interfaces/http/routes/subscription/process.routes.js`: Subscription processing routes
- `src/interfaces/http/routes/notification.routes.js`: Notification routes
- `src/interfaces/http/routes/user.routes.js`: User profile routes

### Core Services

- `src/core/subscription/services/subscription.service.js`: Subscription business logic
- `src/core/notification/service/notification-service.js`: Notification business logic
- `src/core/user/user.service.js`: User management business logic

### Middlewares

- `src/interfaces/http/middleware/auth.middleware.js`: Authentication and user synchronization
- `src/interfaces/http/middleware/errorHandler.js`: Global error handling
- `src/interfaces/http/middleware/apiDocumenter.js`: Swagger documentation

## 🔍 Recent Updates

### User Preferences and Profile Management Implementation

Recently implemented comprehensive user profile and preferences management:

1. Added support for the following endpoints:
   - `/api/v1/users/me` - Get and update user profile information
   - `/api/v1/users/preferences` - Get and update user preferences like language and theme
   - `/api/v1/me/email-preferences` - Get and update email notification settings
   - `/api/v1/me/test-email` - Send test emails for notification verification

2. Enhanced Authentication Service with proper refresh token handling:
   - Added `/api/v1/auth/refresh` endpoint for token refresh
   - Ensured backward compatibility with legacy `/api/auth/refresh` endpoint
   - Improved documentation of authentication endpoints

3. User Profile Features:
   - Profile editing (name, bio, avatar)
   - Theme preference (light/dark/system)
   - Language selection (Spanish, English, Catalan)
   - Email notification preferences:
     - Enable/disable email notifications
     - Custom notification email address
     - Daily digest time configuration

These changes ensure a seamless user experience with proper preferences management and profile customization options. All endpoints are properly documented and follow the established API patterns for consistency.

### User Synchronization Fix

Recently implemented improved user synchronization between authentication and backend:

1. Added `synchronizeUser` function in auth middleware that:
   - Checks if user exists in database upon successful authentication
   - Creates user record if it doesn't exist, using JWT token information
   - Sets default preferences and notification settings

2. Enhanced CORS configuration to allow connections from:
   - Netlify domains
   - Local development environments
   - Cloud Run domains

3. Fixed bugs in Express-style auth middleware:
   - Corrected reference to decoded token
   - Added user synchronization in Express middleware too
   - Improved error handling for synchronization failures

These changes ensure that users who exist in the authentication service but not in the backend database can successfully use features that rely on foreign key relationships.

## 🐛 Troubleshooting

### Database Connectivity Issues

If experiencing database connection problems:
- Verify DATABASE_URL is correct
- Check if database server is running
- Ensure network connectivity to database server
- Verify that all required migrations have been applied

### Authentication Failures

If authentication is failing:
- Verify that JWT_SECRET matches the one used by the authentication service
- Check that Authorization headers are properly formatted (Bearer token)
- Ensure user exists in the authentication service
- Check if user synchronization is working correctly

### API Errors

Common API errors and solutions:
- 401 Unauthorized: Check JWT token validity and headers
- 403 Forbidden: Verify user has permission for the resource
- 400 Bad Request: Check request body format against API schema
- 404 Not Found: Verify resource IDs are correct
- 500 Internal Server Error: Check server logs for detailed error information

## 📋 API Documentation

API documentation is available at `/documentation` when running the server. This provides:
- Interactive API exploration
- Request/response schema examples
- Authentication information
- Test endpoints directly from the browser

## 🚀 Deployment

### Google Cloud Run

```bash
# Build the container
gcloud builds submit --tag gcr.io/PROJECT_ID/nifya-backend

# Deploy to Cloud Run
gcloud run deploy nifya-backend \
  --image gcr.io/PROJECT_ID/nifya-backend \
  --platform managed \
  --set-env-vars DATABASE_URL=postgresql://...,JWT_SECRET=...,NODE_ENV=production
```

### Docker Deployment

```bash
# Build the image
docker build -t nifya-backend .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e NODE_ENV=production \
  nifya-backend
```

---

Built with ❤️ by the NIFYA Team