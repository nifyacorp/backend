# Subscription Routes

This module contains all the API routes related to subscription management.

## Endpoint Structure

All endpoints are under the `/api/v1/subscriptions` prefix:

### Main Endpoints

- `GET /` - List all subscriptions for a user
- `POST /` - Create a new subscription
- `GET /:id` - Get subscription details
- `PUT /:id` - Update a subscription
- `DELETE /:id` - Delete a subscription

### Processing

- `POST /:id/process` - Process a subscription immediately

### Status

- `GET /:id/status` - Get processing status of a subscription

### Sharing

- `POST /:id/share` - Share a subscription
- `GET /:id/share` - Get sharing information for a subscription
- `DELETE /:id/share` - Remove sharing for a subscription

### Types

- `GET /types` - List all subscription types
- `GET /types/:type` - Get details about a specific subscription type

### Statistics

- `GET /stats` - Get subscription statistics

## Code Organization

The routes are organized into separate files for better maintainability:

- `index.js` - Main entry point that registers all other route modules
- `crud.routes.js` - Basic CRUD operations
- `crud-delete.js` - Enhanced delete endpoint
- `process.routes.js` - Subscription processing
- `status.routes.js` - Processing status endpoints
- `sharing.routes.js` - Subscription sharing
- `types.routes.js` - Subscription type information

## Authentication

All endpoints require authentication using Firebase Authentication. The authentication middleware is applied at the API level 