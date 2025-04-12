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
│   │   │       ├── notification/
│   │   │       │   ├── crud.routes.js
│   │   │       │   └── index.js
│   │   │       ├── user.routes.js
│   │   │       └── index.js
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

#### NotificationRoutes (`src/interfaces/http/routes/notification/crud.routes.js`)
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

## 📦 Data Models

### User Settings and Preferences

The application uses a flexible JSONB structure in the `users.metadata` field to store all user preferences and settings. This approach allows for:

1. **Extensibility**: New preferences can be added without schema changes
2. **Structured Storage**: Organized in logical sections for different types of settings
3. **Default Values**: Sensible defaults are provided in the schema

#### Metadata Structure

The `metadata` JSONB field uses the following structure:

```json
{
  "profile": {
    "bio": "Text about the user (500 chars max)",
    "interests": []
  },
  "preferences": {
    "language": "es", 
    "theme": "light"
  },
  "notifications": {
    "email": {
      "enabled": true,
      "useCustomEmail": false,
      "customEmail": null,
      "digestTime": "08:00"
    }
  },
  "security": {
    "lastPasswordChange": "2023-05-15T10:30:00Z",
    "lastLogoutAllDevices": null
  }
}
```

#### Sections and Fields

1. **Profile Information**
   - `profile.bio`: User's self-description (max 500 characters)
   - `profile.interests`: Array of user interests (optional)

2. **Application Preferences**
   - `preferences.language`: UI language preference (default: "es")
   - `preferences.theme`: UI theme preference (default: "light")

3. **Notification Settings**
   - `notifications.email.enabled`: Master switch for email notifications
   - `notifications.email.useCustomEmail`: Whether to use an alternate email
   - `notifications.email.customEmail`: Alternative email address
   - `notifications.email.digestTime`: Time for daily digest (format: "HH:MM")

4. **Security Settings**
   - `security.lastPasswordChange`: Timestamp of last password change
   - `security.lastLogoutAllDevices`: Timestamp of last global logout

These settings complement the `user_email_preferences` table, which stores subscription-specific notification preferences.

#### API Endpoints

For managing user settings, the following endpoints are available:

- `GET /api/v1/users/me`: Get user profile with all settings
- `PATCH /api/v1/users/me`: Update user profile
- `PATCH /api/v1/users/me/preferences`: Update application preferences
- `PATCH /api/v1/users/me/email-preferences`: Update email notification settings

#### Usage in Code

```javascript
// Example: Updating user profile
async function updateUserProfile(userId, profileData) {
  return await db.query(
    `UPDATE users 
     SET metadata = jsonb_set(metadata, '{profile}', $1::jsonb),
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(profileData), userId]
  );
}

// Example: Getting email preferences
async function getEmailPreferences(userId) {
  const { rows } = await db.query(
    `SELECT metadata->'notifications'->'email' as email_preferences
     FROM users
     WHERE id = $1`,
    [userId]
  );
  
  return rows[0]?.email_preferences || {};
}
```

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

## 🚀 Deployment

### Google Cloud Run

The service is deployed on Google Cloud Run with runtime environment variables for configuration. Instead of using .env files (which don't work on GitHub deployments), the backend uses Secret Manager for sensitive information and runtime environment variables configured in Cloud Run.

Runtime environment variables include:
- `PORT`: Server port
- `NODE_ENV`: Environment (production/development)
- `SERVICE_URL`: Public URL of the service
- `GOOGLE_CLOUD_PROJECT`: Google Cloud project ID
- `DATABASE_URL`: Connection string for PostgreSQL

Secret Manager is used for sensitive data:
- `JWT_SECRET`: Used for JWT token signing/verification
- `SERVICE_API_KEY`: API key for service-to-service authentication
- Database credentials

The Dockerfile is designed to be built entirely in Cloud Run so secrets can be accessed:

```Dockerfile
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Set build arguments
ARG BUILD_TIMESTAMP
ARG COMMIT_SHA
ARG DEPLOYMENT_ID

# Set environment variables
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP
ENV COMMIT_SHA=$COMMIT_SHA
ENV DEPLOYMENT_ID=$DEPLOYMENT_ID
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
```

## 🔍 Code Organization

The codebase follows a clear architectural pattern:

1. **Core Layer** (`src/core/`): Contains business logic and domain services
2. **Infrastructure Layer** (`src/infrastructure/`): Handles external communications and infrastructure
3. **Interface Layer** (`src/interfaces/`): Adapts the core to external interfaces like HTTP
4. **Shared Layer** (`src/shared/`): Cross-cutting concerns like error handling

This separation allows for clear dependencies and easier testing.

## 🔑 API Authentication

All API endpoints require JWT authentication with these headers:
- `Authorization: Bearer <token>` - JWT token from auth service
- `X-User-ID: <user-id>` - User ID from the token payload

The authentication flow is:
1. User authenticates with the auth service
2. Auth service provides JWT token
3. Client includes token in all API requests
4. Backend verifies token and synchronizes user data

## 🧰 Development Guide

### Recommended Extensions

For VS Code users, recommended extensions:
- ESLint
- Prettier
- DotENV
- REST Client
- PostgreSQL

### Logging System

The backend uses a centralized logging system through the `src/shared/logger.js` module. This provides consistent logging formats and levels across the application.

#### Using the Logger

When using the logger in services, always import it from the shared module:

```javascript
import logger from '../../../shared/logger.js';
```

#### Logger Methods

The logger provides the following methods that MUST be used:

- `logger.logDebug(context, message, data)`: For debug-level logging
- `logger.logInfo(context, message, data)`: For info-level logging
- `logger.logError(context, message, data)`: For error-level logging
- `logger.logProcessing(context, message, data)`: For processing operations
- `logger.logAuth(context, message, data)`: For authentication operations

Do NOT use `logger.debug()`, `logger.info()`, etc. directly as these methods don't exist on the logger object.

#### Correct Usage Examples

```javascript
// Debug logging - correct way
logger.logDebug({ userId }, 'Getting user notifications', { options });

// Info logging - correct way
logger.logInfo(context, 'Creating subscription', { ...data, userId: data.userId });

// Error logging
logger.error('Error getting user notifications', { 
  error: error.message, 
  stack: error.stack,
  userId, 
  options 
});
```

#### Context Parameter

The first parameter should be a context object containing:
- `userId`: The user ID if available
- `requestId`: Request ID for tracing
- `path`: API path being accessed
- Any other relevant contextual information

This consistent approach ensures proper structured logging and makes debugging easier.

### Best Practices

1. **Row-Level Security**: Use `withRLSContext` for database operations
2. **Validation**: Use schemas for request validation
3. **Error Handling**: Use the `AppError` class for structured errors
4. **Secret Management**: Never hardcode secrets, use Secret Manager
5. **API Documentation**: Keep Swagger documentation up-to-date

## 🚀 Recent Updates

Recent improvements to the backend include:

1. Enhanced notification system with real-time updates
2. User preference management for customized experiences
3. Improved subscription processing with better error handling
4. Integration with specialized parser services (BOE and DOGA)
5. Performance optimizations for faster response times

## 🐛 Troubleshooting

Common issues and solutions:

### Authentication Problems
- Verify JWT token format (must include `Bearer ` prefix)
- Check that the user exists in the database
- Ensure Secret Manager has the correct JWT secret

### Database Connection Issues
- Check database URL and credentials
- Verify Cloud SQL proxy is running (if using local development)
- Ensure RLS policies are correctly configured

### Deployment Failures
- Check Cloud Build logs for detailed error information
- Verify service account permissions
- Ensure all required secrets are configured in Secret Manager