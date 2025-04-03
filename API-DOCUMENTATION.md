# NIFYA API Documentation

This document provides information on how to access and use the NIFYA API documentation.

## Interactive API Documentation

The NIFYA backend includes a comprehensive interactive API documentation system based on OpenAPI/Swagger. This documentation provides:

1. **API Endpoint Reference**: Complete details of all endpoints, parameters, request/response formats
2. **Database Schema Details**: Table structures, relationships, and column definitions
3. **Entity Relationship Diagrams**: Visual representation of the database structure
4. **Implementation Guides**: How-to guides for common API operations

## Accessing Documentation

### During Development

When running the application locally, the documentation is available at:

- **API Endpoints**: http://localhost:8080/documentation
- **Database Schema**: http://localhost:8080/documentation/database
- **Entity Relationships**: http://localhost:8080/documentation/relationships
- **Implementation Guides**: http://localhost:8080/documentation/guides

### Production Environment

The documentation is also available in the production environment at:

- **API Endpoints**: https://backend-415554190254.us-central1.run.app/documentation
- **Database Schema**: https://backend-415554190254.us-central1.run.app/documentation/database
- **Entity Relationships**: https://backend-415554190254.us-central1.run.app/documentation/relationships
- **Implementation Guides**: https://backend-415554190254.us-central1.run.app/documentation/guides

## Generating Documentation

The API documentation can be regenerated to include the latest endpoint changes:

```bash
# Generate updated API documentation
npm run docs:generate

# Serve the documentation locally (if server isn't running)
npm run docs:serve
```

## Features

### API Endpoints Documentation

- **Interactive UI**: Test API endpoints directly from the documentation
- **Request Examples**: Sample payloads for each endpoint
- **Response Schemas**: Detailed response format definitions
- **Authentication Details**: Required headers and token formats
- **Error Codes**: Comprehensive listing of error codes and meanings

### Database Schema Documentation

- **Table Definitions**: Detailed information about each database table
- **Column Details**: Data types, constraints, and descriptions
- **Indexes**: Information about table indexes for performance
- **Relationships**: Foreign key relationships between tables
- **Row Level Security**: Explanation of RLS policies

### Entity Relationship Diagram

- **Visual Representation**: Interactive diagram showing table relationships
- **Cardinality**: One-to-many, many-to-many relationship visualization
- **Entity Details**: Hover over entities to see details

### Implementation Guides

- **Authentication**: How to authenticate with the API
- **Subscriptions**: Creating and managing subscriptions
- **Notifications**: Working with the notification system
- **Best Practices**: Recommended patterns for API usage
- **Error Handling**: Strategies for handling API errors

## Using the Documentation

### Making Test Requests

1. Navigate to the API endpoint documentation
2. Choose an endpoint to test
3. Click "Try it out"
4. Fill in required parameters
5. Add authentication headers
6. Click "Execute"

### Authentication for Testing

When testing endpoints through the documentation UI, you need to:

1. Provide the `Authorization` header with a valid JWT token in the format `Bearer <token>`
2. Include the `x-user-id` header with the user ID

## Keeping Documentation Updated

Please follow these guidelines to keep the documentation current:

1. **Route Definitions**: Ensure all routes include proper OpenAPI annotations
2. **Schema Updates**: Update the Database Schema Reference when making schema changes
3. **Run Generator**: Generate updated docs after significant changes
4. **Review Regularly**: Periodically review docs for accuracy