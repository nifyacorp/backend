# Utility Consolidation Plan for NIFYA Backend

## Current Situation

The backend codebase currently contains multiple utility folders and files with overlapping functionality:

1. `/backend/utils/` - Legacy utility folder with CommonJS modules
   - `logger.js` - Logging utility using Winston 
   - `metrics.js` - StatsD metrics collection
   - `notification-helper.js` - Notification processing utilities
   - `pubsub-client.js` - Google Cloud Pub/Sub client
   - `sql-sanitizer.js` - SQL query sanitization for logging
   - `tracing.js` - OpenTelemetry tracing utilities

2. `/backend/src/shared/utils/` - Modern utility folder with ES modules
   - `api-docs.js` - OpenAPI documentation configuration
   - `apiMetadata.js` - API metadata for documentation
   - `env.js` - Environment variable validation
   - `validation.js` - Validation utilities

3. `/backend/src/shared/logging/` - Logging utilities
   - `logger.js` - Simpler logger with GitHub issue integration

## Usage Analysis

Based on code analysis, the following utilities are actively being used:

### Within backend service:
- From `/backend/utils/`:
  - `logger.js` - Used in subscription-service.js
  - `metrics.js` - Used in subscription-service.js
  
- From `/backend/src/shared/utils/`:
  - `api-docs.js` - Used in infrastructure/server/setup.js
  - `apiMetadata.js` - Used in errors/ErrorResponseBuilder.js and core/apiExplorer/service.js
  - `env.js` - Used in infrastructure/database/client.js

### In other services (references to be aware of):
- Various services (notification-worker, boe-parser, etc.) import from their own `utils` folders
- These imports should not be affected by our backend consolidation

## Consolidation Plan

### 1. Create New Unified Structure

Create a single, organized utility structure under `/backend/src/shared/`:

```
/backend/src/shared/
├── utils/                   # General utilities
│   ├── index.js             # Re-exports all utilities for easier imports
│   ├── validation.js        # Input validation utilities
│   └── env.js               # Environment variable utilities
├── logging/                 # Logging-related utilities
│   ├── index.js             # Re-exports logging utilities
│   ├── logger.js            # Main logger implementation
│   └── sql-sanitizer.js     # SQL query sanitization for logs
├── monitoring/              # Monitoring-related utilities
│   ├── index.js             # Re-exports monitoring utilities
│   ├── metrics.js           # StatsD metrics collection
│   └── tracing.js           # OpenTelemetry tracing
├── documentation/           # API documentation utilities
│   ├── index.js             # Re-exports documentation utilities
│   ├── api-docs.js          # OpenAPI documentation 
│   └── apiMetadata.js       # API metadata helpers
└── messaging/               # Messaging-related utilities
    ├── index.js             # Re-exports messaging utilities
    └── pubsub.js            # Google Cloud Pub/Sub client
```

### 2. Implementation Approach

#### Phase 1: Create the new structure and files

1. Create the folder structure as shown above
2. Create index.js files that re-export utilities for easier imports
3. Implement the most important utilities first:
   - `logging/logger.js` - Unified logger combining features from both implementations
   - `utils/env.js` - Environment variable validation
   - `documentation/api-docs.js` - OpenAPI documentation

#### Phase 2: Migrate and modernize 

1. Migrate each utility from the legacy locations to the new structure, converting to ES modules:
   - Convert CommonJS modules to ES modules (`require()` → `import/export`)
   - Update variable and function names for consistency
   - Add JSDoc documentation
   - Add type information where helpful
   
2. Combine duplicated functionality:
   - Merge the two logger implementations, keeping the best features from each
   - Update import paths in files that use the utilities

#### Phase 3: Update Imports

1. Update all import references in the codebase to use the new locations
2. Use index files for simpler imports (e.g., `import { logger } from '../shared/logging'`)
3. Create backwards compatibility modules in the old locations that re-export from the new locations

#### Phase 4: Clean Up and Testing

1. Test thoroughly to ensure all functionality works
2. Once all imports are updated, mark old utility files as deprecated with comments
3. After validation in production, remove the old utility files

### 3. Migration Priority

1. **Highest Priority**:
   - `logger.js` (most widely used)
   - `env.js` (critical for startup)
   - `api-docs.js` (needed for API documentation)
   
2. **Medium Priority**:
   - `metrics.js` 
   - `sql-sanitizer.js`
   - `validation.js`

3. **Lower Priority**:
   - `pubsub-client.js`
   - `tracing.js`
   - `notification-helper.js` (may need custom handling due to specialty functions)

### 4. Backwards Compatibility Strategy

For each utility being consolidated, we'll implement a backwards compatibility layer:

1. After creating the new implementation, add a file in the old location that:
   - Imports from the new location
   - Re-exports the same interface
   - Includes a deprecation warning (using `console.warn`) that will show during development

Example for backward compatibility:

```javascript
// backend/utils/logger.js (backward compatibility layer)
import { logger, addRequestContext, logRequest, logAuthentication } from '../src/shared/logging/index.js';

console.warn('⚠️ Deprecated: Importing from utils/logger.js is deprecated. Please update imports to use src/shared/logging instead.');

export default logger;
export { addRequestContext, logRequest, logAuthentication };
```

## Implementation Timeline

1. **Week 1**: Set up the new folder structure and implement highest priority utilities
2. **Week 2**: Migrate medium priority utilities and update imports
3. **Week 3**: Migrate lower priority utilities, add backwards compatibility
4. **Week 4**: Testing and cleanup

## Risks and Mitigations

1. **Risk**: Breaking changes in utility interfaces
   **Mitigation**: Maintain the same interfaces in the new implementations and use backwards compatibility layers

2. **Risk**: Missing imports not caught during analysis
   **Mitigation**: Thorough testing and a gradual rollout approach

3. **Risk**: Performance impact during transition
   **Mitigation**: Monitor performance metrics during deployment

## Next Steps

1. Implement the folder structure
2. Begin migration starting with the highest priority utilities
3. Update imports in the codebase
4. Test thoroughly
5. Document the new structure in README.md for developer reference 

## Schema Consolidation Analysis

After analyzing the codebase, we've identified several inconsistencies in how schemas are defined, organized, and used throughout the backend. This document outlines a plan to consolidate these schemas into a unified approach.

### Current State

The backend has multiple schema definition patterns:

1. **Core Module-Specific Schemas**
   - `/backend/src/core/user/schemas.js` - User profile and notification settings schemas
   - `/backend/src/core/user/schemas/email-preferences.schema.js` - Email preferences specific schemas
   - `/backend/src/core/notification/schemas.js` - Notification-related schemas
   - `/backend/src/core/subscription/schemas.js` - Subscription schemas that re-export standardized schemas

2. **Standardized Schema Directory**
   - `/backend/src/schemas/subscription/` - Contains multiple subscription schema files:
     - `base.schema.js`
     - `create.schema.js`
     - `update.schema.js`
     - `response.schema.js`
     - `index.js` (exports all subscription schemas)

3. **Inline Schema Definitions**
   - Some routes define schemas inline using Fastify's schema validation format (JSON Schema)
   - Example: `userProfileSchema` in `user.routes.js`

### Problems Identified

1. **Inconsistent Directory Structure**: Some schemas are in the `/core/{module}/` directory while others are in a dedicated `/schemas/` directory.

2. **Duplicate Schema Definitions**: User-related schemas are defined in multiple places.

3. **Inconsistent Naming Conventions**: Some files use `.schema.js` suffix while others use `schemas.js`.

4. **Mixed Schema Formats**: Some code uses Zod for validation while other code uses Fastify's built-in JSON Schema validation.

5. **Confusing Import Paths**: Developers need to know which pattern is used for each module.

### Consolidation Strategy

We propose a standardized approach to schema organization:

1. **Unified Directory Structure**: Move all schemas to a dedicated `/backend/src/schemas/` directory, organized by domain.

2. **Consistent File Naming**: Use a consistent naming convention for all schema files: `{domain}.schema.js`.

3. **Standardized Export Pattern**: Use index files to aggregate and export schemas from each domain.

4. **Zod as the Standard**: Use Zod for all schema definitions, with utilities to convert to Fastify/JSON Schema when needed.

5. **Clear Separation**: Separate validation schemas from response schemas.

## Implementation Plan

### 1. Create Directory Structure

```
/backend/src/schemas/
  /user/
    base.schema.js        # Base user schemas (UUID, email, etc.)
    profile.schema.js     # User profile schemas
    notifications.schema.js  # Notification preferences
    email-preferences.schema.js  # Email preferences
    index.js              # Exports all user schemas
  /notification/
    base.schema.js
    query.schema.js
    response.schema.js
    index.js
  /subscription/
    (keep existing structure)
  /common/
    base.schema.js        # Common schemas used across domains
    pagination.schema.js  # Pagination schemas
    index.js
  index.js                # Root index file that exports all schemas
```

### 2. Move Existing Schemas

1. Move schemas from `/backend/src/core/user/schemas.js` to appropriate files in `/backend/src/schemas/user/`.
2. Move schemas from `/backend/src/core/user/schemas/email-preferences.schema.js` to `/backend/src/schemas/user/email-preferences.schema.js`.
3. Move schemas from `/backend/src/core/notification/schemas.js` to appropriate files in `/backend/src/schemas/notification/`.
4. Keep subscription schemas as they are (they already follow a good pattern).

### 3. Create Utility Functions

1. Create utility functions to convert Zod schemas to Fastify/JSON Schema format.
2. Create a centralized validation middleware.

### 4. Update Imports

1. Update imports in all files that use the old schema locations.
2. Use consistent import patterns (prefer importing from index files).

### 5. Deprecate Old Schema Locations

1. Add re-export files at old locations that import from the new locations to maintain backward compatibility temporarily.
2. Add deprecation warnings in re-export files.
3. After all references are updated, remove the re-export files.

## Expected Benefits

1. **Single Source of Truth**: All schemas defined in one place.
2. **Better Organization**: Clear structure makes it easy to find schemas.
3. **Consistency**: Unified approach to schema definition and validation.
4. **Improved Developer Experience**: Less confusion about where to find or add schemas.
5. **Better Reusability**: Schemas can be easily shared across modules.

## Implementation Timeline

1. Directory Structure and Schema Migration: 1 day
2. Utility Functions and Middleware: 1 day
3. Import Updates and Testing: 2 days
4. Documentation and Cleanup: 1 day

Total: 5 days 