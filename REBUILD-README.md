# NIFYA Backend Service (Rebuilt)

This is the rebuilt backend service for NIFYA, implementing a domain-driven architecture with clean separation of concerns.

## Architecture

The service follows a layered architecture:

- **Domain Layer**: Core business entities and repository interfaces
- **Application Layer**: Services implementing business logic
- **Infrastructure Layer**: Database, external services, and repository implementations
- **Interface Layer**: API endpoints, controllers, and serialization

## Project Structure

```
src/
├── core/
│   ├── domain/            # Domain entities and repository interfaces
│   │   ├── shared/        # Shared domain components
│   │   ├── subscription/  # Subscription domain
│   │   ├── notification/  # Notification domain
│   │   ├── template/      # Template domain
│   │   └── user/          # User domain
│   ├── application/       # Application services
│   │   ├── shared/        # Shared service interfaces
│   │   ├── subscription/  # Subscription services
│   │   ├── notification/  # Notification services
│   │   ├── template/      # Template services
│   │   └── user/          # User services
│   └── shared/            # Shared components
│       └── errors/        # Error handling
├── infrastructure/        # External dependencies
│   ├── database/          # Database access
│   ├── services/          # External service clients
│   ├── auth/              # Authentication integration
│   └── pubsub/            # PubSub integration
└── interfaces/            # User interfaces
    ├── api/               # API responses
    ├── fastify/           # Fastify plugins
    └── rest/              # REST API endpoints
```

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm 7 or higher
- Supabase account and project

### Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Key Features

- **Domain-Driven Design**: Clear separation of domain entities and business logic
- **Clean Architecture**: Independence from frameworks and external dependencies
- **Standardized API Responses**: Consistent response format
- **Error Handling**: Standardized error handling with appropriate status codes
- **API Documentation**: Auto-generated using Swagger/OpenAPI
- **Authentication**: Proper integration with Auth Service
- **Database Access**: Row-level security and repository pattern
- **Validation**: Request validation using schema validation

## API Documentation

API documentation is available at `/documentation` when the server is running.

## Testing

```bash
npm test
```

## Linting and Formatting

```bash
npm run lint
npm run format
```

## Type Checking

```bash
npm run type-check
```

## Deployment

The service is designed for deployment to Cloud Run or similar containerized environments.

## Migration

This is a rebuilt service that maintains API compatibility with the existing service while improving internal architecture and adding new features.