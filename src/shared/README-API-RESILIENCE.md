# API Resilience Components

This document explains the API resilience components implemented in the NIFYA backend to provide self-documenting APIs and helpful error responses.

## Overview

The API resilience system provides:

1. **Self-documenting APIs**: Every endpoint provides detailed documentation about its parameters, responses, and usage.
2. **Helpful Error Messages**: Error responses include not just what went wrong, but how to fix it.
3. **API Discovery**: Clients can discover available endpoints and their capabilities.
4. **Better Debugging**: Error responses include context-specific help.

## Components

### 1. API Metadata Repository

Located at `src/shared/utils/apiMetadata.js`, this is the central source of truth for API documentation. It includes:

- Detailed endpoint definitions
- Required parameters and headers
- Response examples
- Helper functions to find endpoints

### 2. Error Response Builder

Located at `src/shared/errors/ErrorResponseBuilder.js`, this builds standardized, self-documenting error responses by:

- Creating consistent error structures
- Adding endpoint-specific documentation
- Including related endpoints
- Providing example requests

### 3. API Documenter Middleware

Located at `src/interfaces/http/middleware/apiDocumenter.js`, this middleware:

- Validates incoming requests against API metadata
- Checks required parameters
- Validates parameter formats (e.g., UUID)
- Provides helpful validation errors

### 4. Error Handler Middleware

Located at `src/interfaces/http/middleware/errorHandler.js`, this global error handler:

- Transforms all errors into standardized responses
- Handles various error types consistently
- Adds self-documenting information to errors

### 5. API Explorer Service

Located at `src/core/apiExplorer/service.js`, this service:

- Provides health check information
- Lists all available endpoints
- Returns detailed documentation for specific endpoints

### 6. API Explorer Routes

Located at `src/interfaces/http/routes/apiExplorer.routes.js`, these routes:

- Expose API health information at `/api/health`
- List all endpoints at `/api/explorer`
- Provide endpoint-specific documentation at `/api/explorer/:path`

## Usage Examples

### 1. Getting API Health

```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "uptime": "3d 2h 15m 30s",
  "api": {
    "base_url": "https://api.nifya.app",
    "documentation_url": "https://docs.nifya.app",
    "endpoints_count": 12,
    "endpoint_groups": [
      { "name": "Authentication", "base_path": "/api/v1/auth" },
      { "name": "Subscriptions", "base_path": "/api/v1/subscriptions" },
      { "name": "Notifications", "base_path": "/api/v1/notifications" }
    ]
  }
}
```

### 2. Discovering Available Endpoints

```
GET /api/explorer
```

Response:
```json
{
  "endpoints": [
    {
      "path": "/api/v1/subscriptions",
      "methods": ["GET", "POST"],
      "description": "List all subscriptions for the authenticated user"
    },
    {
      "path": "/api/v1/subscriptions/:id",
      "methods": ["GET", "PUT", "DELETE"],
      "description": "Get a specific subscription by ID"
    }
  ],
  "count": 2,
  "documentation_url": "https://docs.nifya.app"
}
```

### 3. Getting Documentation for a Specific Endpoint

```
GET /api/explorer/subscriptions/:id?method=PUT
```

Response:
```json
{
  "documentation": {
    "path": "/api/v1/subscriptions/:id",
    "method": "PUT",
    "description": "Update a subscription",
    "auth_required": true,
    "path_parameters": [
      { "name": "id", "type": "uuid", "description": "Subscription ID", "required": true }
    ],
    "body_parameters": [
      { "name": "name", "type": "string", "description": "Subscription name" },
      { "name": "prompts", "type": "array", "description": "Array of search prompts (max 3)" }
    ]
  },
  "related_endpoints": [
    {
      "path": "/api/v1/subscriptions",
      "methods": ["GET", "POST"]
    }
  ]
}
```

### 4. Helpful Error Response

When sending an invalid request, like using an invalid UUID:

```
PUT /api/v1/subscriptions/not-a-uuid
```

Response:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "The request contains invalid parameters.",
  "status": 400,
  "details": {
    "id": "Invalid UUID format for parameter: id"
  },
  "timestamp": "2023-04-01T12:34:56.789Z",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "help": {
    "endpoint_info": {
      "path": "/api/v1/subscriptions/:id",
      "method": "PUT",
      "description": "Update a subscription",
      "auth_required": true,
      "path_parameters": [
        { "name": "id", "type": "uuid", "description": "Subscription ID", "required": true }
      ],
      "body_parameters": [
        { "name": "name", "type": "string", "description": "Subscription name" },
        { "name": "prompts", "type": "array", "description": "Array of search prompts (max 3)" }
      ]
    },
    "related_endpoints": [
      {
        "path": "/api/v1/subscriptions",
        "methods": ["GET", "POST"]
      }
    ],
    "documentation_url": "https://docs.nifya.app/api/v1/subscriptions/:id"
  }
}
```

## Using the Error Builders in Controllers

When implementing controller methods, use the error builders from `ErrorResponseBuilder.js`:

```javascript
import { errorBuilders } from '../../../shared/errors/ErrorResponseBuilder.js';

export async function getSubscription(req, res, next) {
  const { id } = req.params;
  
  try {
    const subscription = await subscriptionService.getById(id);
    
    if (!subscription) {
      // Return a self-documenting not found error
      return next(errorBuilders.notFound(req, 'Subscription'));
    }
    
    return res.json(subscription);
  } catch (error) {
    // Return a self-documenting server error
    return next(errorBuilders.serverError(req, error));
  }
}
```

## Extending the API Metadata

To add documentation for new endpoints, update the `apiDefinitions` object in `src/shared/utils/apiMetadata.js`:

```javascript
export const apiDefinitions = {
  // ... existing definitions
  
  "/api/v1/your-new-endpoint": {
    "GET": {
      "description": "Description of your new endpoint",
      "auth_required": true,
      "query_parameters": [
        { "name": "param", "type": "string", "description": "Parameter description", "default": "default" }
      ],
      "responses": {
        "200": {
          "description": "Success response description",
          "example": {
            // Example response object
          }
        }
      }
    }
  }
};
```

## Conclusion

By implementing these API resilience components, the NIFYA backend now provides a more robust and developer-friendly API experience. When errors occur, clients receive clear guidance on how to fix issues, what endpoints are available, and how to use them correctly. 