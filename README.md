# NIFYA Backend Orchestration Service

## Vision

NIFYA's Backend Orchestration Service is designed to be the central nervous system of the NIFYA platform, connecting various AI-powered services to provide intelligent notifications tailored to user interests. The vision is to create a scalable, maintainable, and extensible backend system that:

1. **Seamlessly orchestrates multiple specialized AI models** to process different content types with maximum accuracy and efficiency.

2. **Empowers users with control over their information consumption** through flexible subscription management and personalization options.

3. **Transforms unstructured data into actionable insights** by leveraging advanced natural language processing techniques.

4. **Delivers real-time, relevant notifications** through multiple channels based on user preferences.

5. **Scales effortlessly** to handle growing user bases and expanding content sources without compromising performance.

6. **Maintains strict data isolation and security** to protect user privacy and content integrity.

7. **Adapts to evolving requirements** through a modular architecture that allows for easy extension and modification.

The ultimate goal is to build a robust platform that intelligently filters the noise of information overload, delivering only what truly matters to each user at the right time and in the right format.

For technical specifications and implementation details, please refer to the [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) file.

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

## 📁 Complete File Structure

```
backend/
├── src/
│   ├── index.js                   # Main application entry point
│   ├── core/                      # Core business logic
│   │   ├── auth/                  # Authentication related logic
│   │   │   └── auth.service.js
│   │   ├── notification/          # Notification management
│   │   │   └── service/
│   │   │       └── notification-service.js
│   │   ├── subscription/          # Subscription management
│   │   │   └── services/
│   │   │       └── subscription.service.js
│   │   ├── user/                  # User management
│   │   │   └── user.service.js
│   │   ├── apiExplorer/           # API documentation generation
│   │   └── types/                 # TypeScript types and interfaces
│   ├── infrastructure/            # Infrastructure and external connections
│   │   ├── database/              # Database connections
│   │   │   ├── client.js
│   │   │   └── single-schema-migrations.js
│   │   ├── firebase/              # Firebase integration
│   │   ├── pubsub/                # Pub/Sub messaging
│   │   ├── events/                # Event handling
│   │   ├── metrics/               # Monitoring and metrics
│   │   ├── secrets/               # Secret management
│   │   └── server/                # Server configuration
│   ├── interfaces/                # Interface adapters
│   │   ├── http/                  # HTTP interface
│   │   │   ├── middleware/        # Express middleware
│   │   │   │   ├── auth.middleware.js
│   │   │   │   └── errorHandler.js
│   │   │   └── routes/            # API routes
│   │   │       ├── subscription/  
│   │   │       │   ├── crud.routes.js
│   │   │       │   └── process.routes.js
│   │   │       ├── notification.routes.js
│   │   │       └── user.routes.js
│   │   └── events/                # Event handlers
│   ├── schemas/                   # Data validation schemas
│   │   ├── subscription/
│   │   ├── notification/
│   │   └── user/
│   └── shared/                    # Shared utilities
│       ├── errors/
│       └── utils/
├── supabase/                      # Supabase configuration
├── logs/                          # Log files
├── node_modules/                  # Dependencies
├── .env                           # Environment variables
├── .env.example                   # Example environment file
├── consolidated-schema.sql        # Database schema
├── package.json                   # Project configuration
├── package-lock.json              # Dependency lock file
├── Dockerfile                     # Container definition
├── cloudbuild.yaml                # CI/CD configuration
├── .dockerignore                  # Docker ignore file
├── .gitignore                     # Git ignore file
└── README.md                      # Project documentation
```

## 🧩 Core Classes and Modules

### Authentication System

#### AuthService (`src/core/auth/auth.service.js`)
Manages authentication logic and JWT handling.

**Key Methods:**
- `verifyToken(token)`: Verifies JWT token validity
- `generateToken(payload)`: Generates new JWT token
- `refreshToken(refreshToken)`: Generates new access token from refresh token
- `verifyPermissions(userId, resource, action)`: Checks if user has permission

#### AuthMiddleware (`src/interfaces/http/middleware/auth.middleware.js`)
Provides authentication middleware for HTTP routes.

**Key Methods:**
- `authenticate(request, reply)`: Authenticates requests using JWT
- `synchronizeUser(userId, userInfo, context)`: Syncs user data with auth service
- `requirePermission(resource, action)`: Permission-based middleware

### Subscription System

#### SubscriptionService (`src/core/subscription/services/subscription.service.js`)
Manages subscription-related business logic.

**Key Methods:**
- `createSubscription(data, userId)`: Creates new subscription
- `getSubscriptions(userId, filters)`: Retrieves user subscriptions
- `getSubscriptionById(id, userId)`: Retrieves specific subscription
- `updateSubscription(id, data, userId)`: Updates subscription
- `deleteSubscription(id, userId)`: Deletes subscription
- `processSubscription(id, userId)`: Initiates subscription processing
- `validateSubscriptionData(data)`: Validates subscription input

#### SubscriptionRoutes (`src/interfaces/http/routes/subscription/crud.routes.js`)
HTTP routes for subscription management.

**Key Endpoints:**
- `GET /api/v1/subscriptions`: List subscriptions
- `POST /api/v1/subscriptions`: Create subscription
- `GET /api/v1/subscriptions/:id`: Get subscription
- `PUT /api/v1/subscriptions/:id`: Update subscription
- `DELETE /api/v1/subscriptions/:id`: Delete subscription
- `POST /api/v1/subscriptions/:id/process`: Process subscription

### Notification System

#### NotificationService (`src/core/notification/service/notification-service.js`)
Manages notification business logic.

**Key Methods:**
- `getNotifications(query, userId)`: Retrieves user notifications
- `createNotification(data)`: Creates notification
- `markAsRead(id, userId)`: Marks notification as read
- `markAllAsRead(userId)`: Marks all notifications as read
- `deleteNotification(id, userId)`: Deletes notification
- `formatNotification(notification)`: Formats notification for client

#### NotificationRoutes (`src/interfaces/http/routes/notification.routes.js`)
HTTP routes for notification management.

**Key Endpoints:**
- `GET /api/v1/notifications`: List notifications
- `POST /api/v1/notifications`: Create notification (internal)
- `PUT /api/v1/notifications/:id/read`: Mark as read
- `POST /api/v1/notifications/read-all`: Mark all as read
- `DELETE /api/v1/notifications/:id`: Delete notification

### User System

#### UserService (`src/core/user/user.service.js`)
Manages user-related business logic.

**Key Methods:**
- `getUserById(id)`: Retrieves user by ID
- `getUserProfile(userId)`: Gets user profile with preferences
- `updateUserProfile(userId, data)`: Updates user profile
- `getUserPreferences(userId)`: Gets user preferences
- `updateUserPreferences(userId, preferences)`: Updates preferences
- `getEmailPreferences(userId)`: Gets email notification preferences
- `updateEmailPreferences(userId, preferences)`: Updates email preferences
- `sendTestEmail(userId)`: Sends test email to verify settings

#### UserRoutes (`src/interfaces/http/routes/user.routes.js`)
HTTP routes for user management.

**Key Endpoints:**
- `GET /api/v1/users/me`: Get current user profile
- `PUT /api/v1/users/me`: Update user profile
- `GET /api/v1/users/preferences`: Get user preferences
- `PUT /api/v1/users/preferences`: Update preferences
- `GET /api/v1/me/email-preferences`: Get email preferences
- `PUT /api/v1/me/email-preferences`: Update email preferences
- `POST /api/v1/me/test-email`: Send test email

### Infrastructure Components

#### DatabaseClient (`src/infrastructure/database/client.js`)
Manages database connections and queries.

**Key Methods:**
- `query(text, params)`: Executes SQL query
- `getClient()`: Gets database client from pool
- `withTransaction(callback)`: Executes callback in transaction
- `setRLSContext(userId)`: Sets Row-Level Security context
- `withRLSContext(userId, callback)`: Executes with RLS context

#### SecretManager (`src/infrastructure/secrets/secretManager.js`)
Manages access to secrets stored in Google Secret Manager.

**Key Methods:**
- `getSecret(secretName)`: Retrieves secret by name
- `cacheSecret(secretName, value)`: Caches secret for reuse
- `clearCache()`: Clears secret cache

#### PubSubClient (`src/infrastructure/pubsub/client.js`)
Manages Pub/Sub messaging for asynchronous processing.

**Key Methods:**
- `publishMessage(topicName, data)`: Publishes message to topic
- `subscribe(subscriptionName, callback)`: Subscribes to topic
- `createSubscription(topicName, subscriptionName)`: Creates subscription

#### ErrorHandler (`src/interfaces/http/middleware/errorHandler.js`)
Global error handling middleware.

**Key Methods:**
- `handleError(error, request, reply)`: Processes errors
- `formatError(error)`: Formats error for client response
- `logError(error)`: Logs error with appropriate severity

## 🔄 Class Relationships

1. **Request Flow**:
   - HTTP Request → AuthMiddleware → Route Handler → Service → Database
   - AuthMiddleware synchronizes users with UserService
   - Route handlers use Services to process business logic
   - Services interact with DatabaseClient for data operations

2. **Subscription Processing Flow**:
   - SubscriptionService.processSubscription() → PubSubClient.publishMessage()
   - Specialized Parser Services (BOE Parser, DOGA Parser) → NotificationService.createNotification()
   - NotificationService → EventEmitter → Socket.IO → Client

3. **Authentication Flow**:
   - Request → AuthMiddleware.authenticate() → AuthService.verifyToken()
   - AuthMiddleware.synchronizeUser() → UserService.getUserById() or create
   - AuthService.refreshToken() → Generate new tokens

4. **Data Flow**:
   - Client → API Routes → Validation Schemas → Services → DatabaseClient → Database
   - Database → DatabaseClient → Services → Response Formatting → Client

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

For a comprehensive list of all available API endpoints, please refer to the [API-DOCS.md](./API-DOCS.md) file.

### Authentication

All authenticated routes require:
- `Authorization: Bearer <token>` header
- `X-User-ID: <user-id>` header

## 📦 Data Models

### Subscription Schema

The backend uses standardized subscription schemas for validation and type safety. These schemas are defined in `src/schemas/subscription/` and include:

- **Base Schema**: Common fields and validation rules for all subscriptions
- **Create Schema**: Rules for creating new subscriptions
- **Update Schema**: Rules for updating existing subscriptions
- **Response Schema**: Structures for API responses

The standardized fields are:
- `name`: String (3-100 chars) - Subscription name
- `description`: Optional string (max 500 chars)
- `type`: Enum ('boe', 'real-estate', 'custom') - Subscription type
- `prompts`: Array of 1-3 strings - Search terms or instructions
- `frequency`: Enum ('immediate', 'daily') - Processing frequency
- `active`: Boolean - Subscription status

These schemas enforce consistent validation across all subscription endpoints, improving API reliability and providing clear error messages.

```javascript
// Example of using the schemas in a route handler
const validationResult = CreateSubscriptionSchema.safeParse(request.body);
    
if (!validationResult.success) {
  // Extract error details for better error messages
  const errors = validationResult.error.format();
  
  throw new AppError(
    'VALIDATION_ERROR',
    'Invalid subscription data',
    400,
    { validationErrors: errors }
  );
}
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
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here

# Server Configuration
PORT=3000
SERVICE_URL=your-cloud-run-url

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=delta-entity-447812-p2
INSTANCE_CONNECTION_NAME=delta-entity-447812-p2:us-central1:nifya-db
JWT_SECRET_NAME=projects/delta-entity-447812-p2/secrets/JWT_SECRET/versions/latest

# Security
SERVICE_API_KEY=your-secure-api-key-here
```

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Available Scripts

- `npm run start` - Start production server
- `npm run dev` - Start development server with hot reloading
- `npm run migrations` - Run database migrations
- `npm run docs:generate` - Generate API documentation
- `npm run docs:serve` - Serve documentation locally

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

## 🔍 Code Organization and Known Issues

The codebase is in a transitional state with some architectural challenges:

### Service Duplication

There is duplication in core services with both legacy and new implementations:

- **Notification Services**: 
  - `backend/services/notification-service.js`
  - `backend/src/core/notification/notification-service.js`

- **Subscription Services**:
  - `backend/services/subscription-service.js`
  - `backend/src/core/subscription/services/subscription.service.js`

This can cause confusion about which implementation to use. Prefer the implementations in the `src/core` directory.

### RLS Context for Database Queries

Database operations require proper Row-Level Security (RLS) context:

- Use `setRLSContext(userId)` before querying user-specific data
- Use `withRLSContext(userId, callback)` for operations within a context

```javascript
// Example using setRLSContext
await setRLSContext(userId);
const result = await query('SELECT * FROM notifications WHERE user_id = $1', [userId]);

// Example using withRLSContext
await withRLSContext(userId, async () => {
  return await query('SELECT * FROM notifications WHERE user_id = $1', [userId]);
});
```

### Authentication Headers

Authentication requires specific header formatting:

- `Authorization` header must include a space after "Bearer": `Bearer <token>`
- Both `Authorization` and `X-User-ID` headers are required

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

For a comprehensive reference, see [API-DOCS.md](./API-DOCS.md).

## 🚀 Deployment

### Google Cloud Run

The service is deployed on Google Cloud Run using the cloudbuild.yaml configuration:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build', 
      '-t', 
      'gcr.io/$PROJECT_ID/nifya-orchestration-service', 
      '--build-arg', 
      'BUILD_TIMESTAMP=${_BUILD_TIMESTAMP}',
      '--build-arg',
      'COMMIT_SHA=$COMMIT_SHA',
      '--build-arg',
      'DEPLOYMENT_ID=$BUILD_ID',
      '.'
    ]
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/nifya-orchestration-service']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'nifya-orchestration-service'
      - '--image'
      - 'gcr.io/$PROJECT_ID/nifya-orchestration-service'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'NODE_ENV=production,BUILD_TIMESTAMP=${_BUILD_TIMESTAMP},COMMIT_SHA=$COMMIT_SHA,DEPLOYMENT_ID=$BUILD_ID'
```

## Database Schema

The NIFYA platform uses a PostgreSQL database with a clean, consolidated schema approach:

### Single Schema Approach

We've migrated from using multiple incremental migrations to a single consolidated schema file:

- **Location**: `backend/consolidated-schema.sql`
- **Version Tracking**: Via `schema_version` table
- **Initialization**: Automatic during application startup

This approach eliminates dependency conflicts, schema drift, and inconsistencies between environments.

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | Stores user accounts and profile information |
| `subscription_types` | Defines available subscription types (BOE, DOGA, real-estate, etc.) |
| `subscriptions` | User subscriptions for different data sources |
| `subscription_processing` | Tracks processing status of subscriptions |
| `notifications` | Notifications for users based on subscription matches |
| `user_email_preferences` | User preferences for email notifications |

### Database Initialization

The database is automatically initialized on application startup:

1. The application reads `consolidated-schema.sql`
2. It checks if the schema is already applied (via `schema_version` table)
3. It applies the schema if needed or if it's the first run

No manual migrations or SQL commands are required. This is handled in:
`src/infrastructure/database/single-schema-migrations.js`

---

Built with ❤️ by the NIFYA Team