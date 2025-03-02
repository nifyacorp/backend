# Middleware Unification

This directory contains the unified middleware for the backend service. Previously, middleware was split between two directories (`middleware` and `middlewares`), which has now been consolidated into a single location.

## Structure

- `auth.middleware.js` - Authentication middleware for both Fastify and Express-style applications

## Benefits of Unification

1. **Consistency**: All middleware is now in a single location with a consistent naming convention
2. **Reduced Confusion**: Eliminates the confusion of having two similar directories
3. **Better Organization**: Follows the standard practice of using a singular form for directory names
4. **Improved Imports**: Simplifies import paths and makes them more predictable

## Implementation Notes

The unification preserves all existing functionality while improving the code organization. The main changes are:

1. Merged the functionality from both `middleware/auth.middleware.js` and `middlewares/auth.js`
2. Standardized on the singular form `middleware` for the directory name
3. Added better documentation and comments
4. Ensured backward compatibility by exporting both Fastify and Express-style middleware

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