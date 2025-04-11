# NIFYA Backend Technical Specification

This document provides detailed technical specifications for the NIFYA Backend service, including architecture diagrams, component relationships, class structures, API designs, and test strategies.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Logical Architecture](#logical-architecture)
3. [Component Design](#component-design)
4. [Data Model](#data-model)
5. [API Design](#api-design)
6. [Security Implementation](#security-implementation)
7. [Error Handling](#error-handling)
8. [Testing Strategy](#testing-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Deployment Specifications](#deployment-specifications)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Applications                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  Web Frontend  │  │  Mobile Apps   │  │  External Integrations │ │
│  └────────────────┘  └────────────────┘  └────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Gateway / Load Balancer                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NIFYA Backend Service (Node.js)                  │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ HTTP Interface │  │ WebSocket Server │  │ Authentication     │   │
│  └────────────────┘  └──────────────────┘  └────────────────────┘   │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ Core Services  │  │ Business Logic   │  │ Event Bus          │   │
│  └────────────────┘  └──────────────────┘  └────────────────────┘   │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ Data Access    │  │ Caching Layer    │  │ External Services  │   │
│  └────────────────┘  └──────────────────┘  └────────────────────┘   │
└───────┬─────────────────────┬─────────────────────────┬─────────────┘
        │                     │                         │
        ▼                     ▼                         ▼
┌─────────────┐      ┌───────────────┐          ┌─────────────────────┐
│ PostgreSQL  │      │ Redis Cache   │          │ External Services   │
│ Database    │      │               │          │ - Auth Service      │
└─────────────┘      └───────────────┘          │ - BOE Parser        │
                                                │ - DOGA Parser       │
                                                │ - Email Service     │
                                                └─────────────────────┘
```

### Service Communication Flow

```
┌──────────────┐       ┌───────────────┐      ┌───────────────┐
│ Auth Service │◄─────►│ Backend       │◄────►│ BOE/DOGA      │
└──────────────┘       │ Service       │      │ Parsers       │
                       └───────┬───────┘      └───────────────┘
                               │
                               ▼
                       ┌───────────────┐      ┌───────────────┐
                       │ Subscription  │◄────►│ Notification  │
                       │ Worker        │      │ Worker        │
                       └───────────────┘      └───────────────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │ Email         │
                                              │ Notification  │
                                              └───────────────┘
```

## Logical Architecture

### Clean Architecture Implementation

The backend follows Clean Architecture principles, organizing code in concentric layers:

```
┌────────────────────────────────────────────┐
│ Interfaces Layer (REST, WebSockets)        │
│ ┌────────────────────────────────────────┐ │
│ │ Application Layer (Use Cases)          │ │
│ │ ┌────────────────────────────────────┐ │ │
│ │ │ Domain Layer (Business Entities)   │ │ │
│ │ │ ┌────────────────────────────────┐ │ │ │
│ │ │ │ Infrastructure Layer           │ │ │ │
│ │ │ └────────────────────────────────┘ │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

* **Interfaces Layer**: HTTP routes, WebSocket handlers, middleware
* **Application Layer**: Use cases, service orchestration
* **Domain Layer**: Business entities, rules, service interfaces
* **Infrastructure Layer**: Database access, external services, caching

### Component Dependency Graph

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ HTTP Routes   │────►│ Controllers   │────►│ Services      │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
┌───────────────┐     ┌───────────────┐             │
│ WebSockets    │────►│ Event         │◄────────────┘
└───────────────┘     │ Handlers      │             ▲
                      └───────────────┘             │
                             │                      │
                             ▼                      │
                      ┌───────────────┐     ┌───────────────┐
                      │ Repositories  │────►│ Models        │
                      └───────────────┘     └───────────────┘
```

## Component Design

### Core Services Class Diagram

```
┌───────────────────────┐      ┌────────────────────────┐
│ SubscriptionService   │      │ NotificationService    │
├───────────────────────┤      ├────────────────────────┤
│ - repository          │      │ - repository           │
├───────────────────────┤      ├────────────────────────┤
│ + createSubscription()│      │ + getNotifications()   │
│ + getSubscription()   │      │ + createNotification() │
│ + updateSubscription()│      │ + markAsRead()         │
│ + deleteSubscription()│      │ + deleteNotification() │
│ + processSubscription()│     │ + notifyUser()         │
└─────────┬─────────────┘      └─────────┬──────────────┘
          │                              │
          ▼                              ▼
┌───────────────────────┐      ┌────────────────────────┐
│ SubscriptionRepository│      │ NotificationRepository │
├───────────────────────┤      ├────────────────────────┤
│ - db                  │      │ - db                   │
├───────────────────────┤      ├────────────────────────┤
│ + create()            │      │ + create()             │
│ + findById()          │      │ + findById()           │
│ + findByUserId()      │      │ + findByUserId()       │
│ + update()            │      │ + update()             │
│ + delete()            │      │ + delete()             │
└───────────────────────┘      └────────────────────────┘
```

### Authentication Flow Sequence

```
┌──────────┐      ┌───────────┐      ┌────────────┐      ┌──────────┐
│ Client   │      │ Auth      │      │ Backend    │      │ Database │
└────┬─────┘      │ Middleware│      │ Service    │      └────┬─────┘
     │            └─────┬─────┘      └─────┬──────┘           │
     │ Request with JWT      │            │                   │
     │─────────────────────►│            │                   │
     │                  │ Verify JWT     │                   │
     │                  │────────────────┼───────────────────┤
     │                  │                │                   │
     │                  │ Check User     │                   │
     │                  │────────────────┼───────────────►│
     │                  │                │                │
     │                  │                │         Create if not exists
     │                  │                │                │
     │                  │ User Info      │◄───────────────┤
     │                  │◄───────────────┼────────────────┤
     │                  │                │                │
     │ Auth Success     │                │                │
     │◄─────────────────┤                │                │
     │                  │                │                │
```

## Data Model

### Core Entities Relationships

```
┌────────────────┐       ┌───────────────────┐
│ User           │       │ SubscriptionType  │
├────────────────┤       ├───────────────────┤
│ id             │       │ id                │
│ email          │       │ name              │
│ name           │       │ description       │
│ preferences    │       │ templates         │
│ created_at     │       │ processors        │
└────────┬───────┘       └─────────┬─────────┘
         │                         │
         │ 1                       │ 1
         ▼ *                       ▼ *
┌────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│ Subscription   │       │ SubProcessing     │       │ Notification     │
├────────────────┤       ├───────────────────┤       ├──────────────────┤
│ id             │       │ id                │       │ id               │
│ user_id        │1     1│ subscription_id   │1     *│ subscription_id  │
│ type_id        │───────│ status            │───────│ title            │
│ name           │       │ result            │       │ content          │
│ prompts        │       │ processed_at      │       │ read             │
│ frequency      │       │ error             │       │ source_url       │
│ active         │       │ retry_count       │       │ metadata         │
│ created_at     │       │ completed_at      │       │ created_at       │
└────────────────┘       └───────────────────┘       └──────────────────┘
```

### Database Schema

The database uses a single consolidated schema approach for consistency:

```sql
-- Users table storing user information
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscription types defining available subscription categories
CREATE TABLE subscription_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    templates JSONB DEFAULT '{}',
    processors JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_id TEXT NOT NULL REFERENCES subscription_types(id),
    name TEXT NOT NULL,
    description TEXT,
    prompts JSONB NOT NULL,
    frequency TEXT DEFAULT 'daily',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscription processing tracking
CREATE TABLE subscription_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    result JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email preferences for notifications
CREATE TABLE user_email_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    digest_frequency TEXT DEFAULT 'daily',
    notifications_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Design

### RESTful Endpoints

#### Subscription Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/api/v1/subscriptions` | List user subscriptions | - | Array of subscription objects |
| GET | `/api/v1/subscriptions/:id` | Get subscription details | - | Subscription object |
| POST | `/api/v1/subscriptions` | Create subscription | Subscription data | Created subscription |
| PUT | `/api/v1/subscriptions/:id` | Update subscription | Updated fields | Updated subscription |
| DELETE | `/api/v1/subscriptions/:id` | Delete subscription | - | Success message |
| POST | `/api/v1/subscriptions/:id/process` | Trigger processing | - | Processing status |

#### Notification Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/api/v1/notifications` | List user notifications | - | Array of notification objects |
| GET | `/api/v1/notifications/:id` | Get notification details | - | Notification object |
| PUT | `/api/v1/notifications/:id/read` | Mark as read | - | Updated notification |
| DELETE | `/api/v1/notifications/:id` | Delete notification | - | Success message |

#### User Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/api/v1/users/me` | Get user profile | - | User object |
| PUT | `/api/v1/users/me` | Update user profile | Updated fields | Updated user |
| GET | `/api/v1/users/preferences` | Get preferences | - | Preferences object |
| PUT | `/api/v1/users/preferences` | Update preferences | Updated preferences | Updated preferences |
| GET | `/api/v1/me/email-preferences` | Get email preferences | - | Email preferences |
| PUT | `/api/v1/me/email-preferences` | Update email preferences | Email settings | Updated settings |

### WebSocket Events

| Event | Description | Payload | Direction |
|-------|-------------|---------|-----------|
| `notification:new` | New notification created | Notification object | Server → Client |
| `notification:read` | Notification marked as read | Notification ID | Server → Client |
| `subscription:status` | Subscription status changed | Status object | Server → Client |
| `client:subscribe` | Client subscribes to updates | User ID | Client → Server |
| `client:disconnect` | Client disconnects | - | Client → Server |

## Security Implementation

### Authentication Flow

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│ Client   │         │ Auth Service │         │ Backend      │
└────┬─────┘         └──────┬───────┘         └──────┬───────┘
     │  Login Request       │                        │
     │───────────────────►│                        │
     │                     │                        │
     │  JWT Token          │                        │
     │◄────────────────────┤                        │
     │                     │                        │
     │ Request with JWT    │                        │
     │────────────────────────────────────────────►│
     │                     │                        │
     │                     │ Verify Token (if needed) │
     │                     │◄───────────────────────┤
     │                     │                        │
     │                     │ Token Verification     │
     │                     │────────────────────────►
     │                     │                        │
     │ Response            │                        │
     │◄────────────────────────────────────────────┤
```

### Authorization and Row-Level Security

The backend implements authorization through:

1. JWT verification in auth middleware
2. Database Row-Level Security (RLS) for data isolation
3. User context propagation for multi-tenant safety

```javascript
// Example RLS implementation
async function setRLSContext(userId) {
  await query('SET LOCAL app.current_user_id = $1', [userId]);
}

// RLS policies in database
CREATE POLICY subscription_isolation ON subscriptions 
  USING (user_id = current_setting('app.current_user_id')::UUID);
```

## Error Handling

### Error Hierarchy

```
AppError (Base class)
  ├── ValidationError
  │     └── SchemaValidationError
  ├── AuthenticationError
  │     ├── TokenExpiredError
  │     └── InvalidTokenError
  ├── AuthorizationError
  ├── ResourceNotFoundError
  ├── DatabaseError
  │     ├── ConnectionError
  │     └── QueryError
  └── ExternalServiceError
        ├── ParserServiceError
        └── EmailServiceError
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "status": 400,
    "details": {
      "validationErrors": {
        "name": "Name is required",
        "prompts": "At least one prompt is required"
      }
    },
    "requestId": "req-123456"
  }
}
```

## Testing Strategy

### Test Pyramid

```
                   ┌──────────┐
                   │   E2E    │
                   │  Tests   │
                   └──────────┘
              ┌───────────────────┐
              │   Integration     │
              │      Tests        │
              └───────────────────┘
        ┌──────────────────────────────┐
        │         Unit Tests           │
        └──────────────────────────────┘
```

### Test Suites

1. **Unit Tests**
   - Service function tests
   - Repository tests with mocked database
   - Utility function tests
   - Schema validation tests

2. **Integration Tests**
   - API endpoint tests with test database
   - Database query tests
   - Authentication flow tests
   - Error handling tests

3. **End-to-End Tests**
   - Complete user flows
   - Cross-service interaction tests
   - Real-time notification tests

### Test File Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── subscription.service.test.js
│   │   └── notification.service.test.js
│   ├── repositories/
│   │   ├── subscription.repository.test.js
│   │   └── notification.repository.test.js
│   └── utils/
│       └── validators.test.js
├── integration/
│   ├── api/
│   │   ├── subscription.routes.test.js
│   │   └── notification.routes.test.js
│   └── database/
│       └── queries.test.js
└── e2e/
    ├── subscription-flow.test.js
    └── notification-flow.test.js
```

## Performance Considerations

### Caching Strategy

```
┌────────────┐      ┌────────────┐      ┌────────────┐
│ API Request│─────►│ Cache Check│─────►│ Database   │
└────────────┘      └─────┬──────┘      └─────┬──────┘
                          │                   │
                          │ Cache Hit         │ Cache Miss
                          ▼                   ▼
                    ┌────────────┐      ┌────────────┐
                    │ Return from│      │ Fetch and  │
                    │ Cache      │◄─────┤ Store      │
                    └────────────┘      └────────────┘
```

### Optimization Techniques

1. **Query Optimization**
   - Indexed fields: user_id, subscription_id, created_at
   - Pagination for large result sets
   - Selective column queries

2. **Connection Pooling**
   - Configurable pool size based on load
   - Connection timeout handling
   - Idle connection management

3. **Asynchronous Processing**
   - Background processing for subscription execution
   - Event-driven notification delivery
   - Batch processing for email digests

## Deployment Specifications

### Docker Configuration

```dockerfile
FROM node:18-alpine AS base

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Set environment variables
ENV NODE_ENV production
ENV PORT 8080

# Expose the port
EXPOSE 8080

# Start the service
CMD ["node", "src/index.js"]
```

### Cloud Run Deployment

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build', 
      '-t', 
      'gcr.io/$PROJECT_ID/nifya-orchestration-service',
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
      - 'NODE_ENV=production'
```

### Scaling Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Min Instances | 1 | Minimum number of instances to maintain |
| Max Instances | 10 | Maximum number of instances to scale to |
| CPU Utilization | 80% | Scale up when CPU exceeds this threshold |
| Concurrency | 80 | Maximum concurrent requests per instance |
| Request Timeout | 60s | Maximum time for request processing |

---

This technical specification provides a comprehensive guide for understanding and implementing the NIFYA Backend service. It should be used as a reference during development, testing, and deployment of the system. 