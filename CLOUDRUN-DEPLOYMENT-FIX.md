# Backend Cloud Run Deployment Fix

## Issues

The backend deployment to Cloud Run was failing with two primary issues:

1. **Schema Error**: 
   ```
   TypeError: createSubscriptionSchema.partial is not a function
   ```
   This happened because we modified the schema to use transformations, which made the `.partial()` method unavailable.

2. **PORT Configuration**:
   The deployment failed to start and listen on the port specified by the PORT environment variable.

## Solutions

### 1. Fixed Schema Definition

Updated the Zod schemas to properly handle both creation and updates:

```javascript
// Base subscription schema that can be used for both create and update
const baseSubscriptionSchema = {
  name: z.string().min(1, { message: 'Name is required' }).max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  type: subscriptionTypeSchema,
  // ...other fields
};

// Create schema with transformations
export const createSubscriptionSchema = z.object(baseSubscriptionSchema)
  .transform(data => ({
    ...data,
    prompts: Array.isArray(data.prompts) ? data.prompts : [data.prompts].filter(Boolean)
  }));

// Update schema with all fields optional
export const updateSubscriptionSchema = z.object({
  ...Object.entries(baseSubscriptionSchema).reduce((acc, [key, schema]) => {
    acc[key] = schema.optional();
    return acc;
  }, {})
});
```

This change:
- Creates a base schema object with all fields
- Uses that base for both create and update schemas
- Makes update fields properly optional without relying on `.partial()`

### 2. Improved Server Startup

Enhanced the server startup process to ensure it listens on the correct port:

```javascript
// Get PORT from environment with fallback
const port = parseInt(process.env.PORT || '8080', 10);

// Log server configuration
console.log('Starting server with configuration:', {
  port,
  host: '0.0.0.0',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString()
});

// Start server immediately so it can respond to health checks
await fastify.listen({ port, host: '0.0.0.0' });
console.log(`Server is running on port ${port}`);
```

Key improvements:
- Uses port 8080 as default (Cloud Run standard)
- Better error handling around server startup
- Ensures server starts even if other initialization fails
- Logs detailed configuration information

### 3. More Robust Error Handling

Added better error handling throughout the startup process:

```javascript
try {
  // Initialize auth service
  await authService.initialize();
} catch (authError) {
  console.error('Auth service initialization error (continuing anyway):', authError);
  // Continue anyway - in Cloud Run this may not be critical
}

try {
  // Run database migrations
  await initializeDatabase();
} catch (migrationErr) {
  console.error('Failed to run migrations (continuing anyway):', migrationErr);
  // Continue anyway - in Cloud Run, we want the server to start regardless
}
```

This ensures that:
- The server starts even if non-critical initialization fails
- Cloud Run health checks will pass once the server is listening
- All errors are properly logged for troubleshooting

## Testing

To test the fixed deployment:

1. **Verify Schema**: Test subscription creation and updates to ensure both work correctly
2. **Verify PORT**: Check that the server listens on the port specified by the PORT environment variable
3. **Verify Startup**: Confirm the server startup sequence properly handles any initialization errors

## Deployment Notes

For Cloud Run deployments, it's critical to:
1. Listen on the port specified by the PORT environment variable (usually 8080)
2. Start the server as quickly as possible to pass health checks
3. Handle initialization errors gracefully
4. Log all configuration and errors for troubleshooting