# Middleware Consolidation Plan

## Current State Analysis

The backend codebase currently has multiple middleware implementations spread across different directories:

1. `/backend/src/interfaces/http/middleware/` - Contains:
   - `auth.middleware.js` (364 lines) - Authentication middleware for both Fastify and Express
   - `apiDocumenter.js` (78 lines) - API documentation and request validation
   - `errorHandler.js` (58 lines) - Global error handling
   - `README.md` - Documentation describing middleware unification

2. `/backend/src/interfaces/http/middlewares/` - Contains:
   - `auth.js` (90 lines) - A separate authentication middleware implementation

3. Additional middleware-related code:
   - `/backend/src/shared/utils/validation.js` - Contains validation utilities that create middleware functions

## Issues Identified

1. **Inconsistent Directory Naming**: Mixture of singular (`middleware`) and plural (`middlewares`) directory names.
2. **Duplicate Functionality**: Two separate authentication middleware implementations.
3. **Inconsistent File Naming**: Some files have `.middleware.js` suffix while others don't.
4. **Import Confusion**: Developers need to remember which implementation to import from where.
5. **Maintenance Burden**: Multiple implementations require maintaining parallel code.

## Consolidation Plan

### 1. Standardize on Single Directory

Use `/backend/src/interfaces/http/middleware/` (singular form) as the standard directory for all middleware.

### 2. Merge Authentication Implementations

1. Use the more comprehensive `auth.middleware.js` (364 lines) and ensure it covers all functionality from the smaller `auth.js` (90 lines).
2. Pay special attention to ensure:
   - The combined implementation handles both Fastify hooks and Express middleware patterns
   - User synchronization functionality is preserved
   - All public paths exclusions are included from both implementations

### 3. Standardize File Naming

Use consistent naming convention for all middleware files:
- `auth.middleware.js` (keep as is)
- `api-documenter.middleware.js` (rename from `apiDocumenter.js`)
- `error-handler.middleware.js` (rename from `errorHandler.js`)

### 4. Update Imports

Find and update all import statements that reference the old paths:
1. `import { authMiddleware } from './interfaces/http/middlewares/auth.js';` →
   `import { authMiddleware } from './interfaces/http/middleware/auth.middleware.js';`

2. Replace other middleware imports as needed to match the new structure.

### 5. Remove Redundant Code

Once imports are updated:
1. Delete the `/backend/src/interfaces/http/middlewares/` directory
2. Remove any duplicate code

## Implementation Steps

1. Create backup/branch before making changes
2. Merge auth implementations into single file
3. Standardize file naming
4. Update all import statements
5. Test functionality thoroughly
6. Remove redundant files and folders

## Additional Considerations

- No backward compatibility layer is needed - just implement the changes directly
- Focus only on consolidating middleware in the backend repository
- Validation utilities in `/backend/src/shared/utils/validation.js` can stay where they are as they're not middleware implementations but utilities to create middleware functions

## Estimated Timeline

- Code review and planning: 1 day
- Implementation and testing: 2-3 days
- Documentation updates: 1 day
- Testing and validation: 1-2 days

Total estimated time: 5-7 working days 