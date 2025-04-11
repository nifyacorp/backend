# Middleware Consolidation

This directory contains the unified middleware for the backend service. The middleware was previously split between two directories (`middleware` and `middlewares`), which has now been consolidated into a single location with a consistent naming convention.

## Structure

- `auth.middleware.js` - Authentication middleware for both Fastify and Express-style applications
- `api-documenter.middleware.js` - API documentation and request validation
- `error-handler.middleware.js` - Global error handling

## Benefits of Consolidation

1. **Consistency**: All middleware is now in a single location with a consistent naming convention
2. **Reduced Confusion**: Eliminates the confusion of having two similar directories
3. **Better Organization**: Follows the standard practice of using a singular form for directory names
4. **Improved Imports**: Simplifies import paths and makes them more predictable

## Implementation Notes

The consolidation preserves all existing functionality while improving the code organization. The main changes are:

1. Retained the comprehensive authentication implementation from `auth.middleware.js`
2. Standardized on the singular form `middleware` for the directory name
3. Standardized file naming convention with `.middleware.js` suffix
4. Removed the redundant `/middlewares` directory

## Usage

### Fastify Authentication

```javascript
import { authenticate } from './interfaces/http/middleware/auth.middleware.js';

// Register as a hook
fastify.addHook('onRequest', authenticate);
```

### Express-style Authentication

```javascript
import { authMiddleware } from './interfaces/http/middleware/auth.middleware.js';

// Use as middleware
app.use(authMiddleware);
```

## Future Improvements

- Add unit tests for middleware functions
- Consider adding more specialized middleware for common tasks
- Add performance metrics to middleware functions 