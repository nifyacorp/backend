# Authentication and User Synchronization Fix

## Problem
The frontend was experiencing CORS issues when connecting to the authentication service. Additionally, users that existed in the authentication service but not in the backend database caused foreign key constraint errors when trying to create subscriptions.

## Solution

### 1. CORS Configuration Updates

We updated the CORS configuration in both the authentication service and backend to explicitly allow connections from Cloud Run domains:

#### Authentication Service
```typescript
// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    const allowedDomains = [
      // Netlify domains
      '.netlify.app',
      // Local development
      'localhost',
      '127.0.0.1',
      // Cloud Run domains
      '.run.app',
      // Specifically allow the main page domain
      'main-page-415554190254.us-central1.run.app'
    ];
    
    // Check if origin matches any allowed domain
    const isAllowed = allowedDomains.some(domain => {
      return domain.startsWith('.') 
        ? origin.endsWith(domain)
        : origin.includes(domain);
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    // Log blocked origin for debugging
    console.log(`CORS blocked origin: ${origin}`);
    
    // Block other origins
    callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
```

#### Backend Service
Similar CORS configuration for the backend service to allow the same domains.

### 2. User Synchronization

Implemented a new `synchronizeUser` function in the authentication middleware that:

1. Checks if a user exists in the database
2. If not, creates a new user record using the information from the JWT token
3. Sets up default preferences and notification settings

```javascript
/**
 * Synchronizes the user from auth token to database
 * Creates user record if it doesn't exist
 */
async function synchronizeUser(userId, userInfo, context) {
  try {
    logger.logAuth(context, 'Checking if user exists in database', { userId });
    
    // Check if user exists in database
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    
    // If user exists, no need to synchronize
    if (userResult.rows.length > 0) {
      logger.logAuth(context, 'User exists in database, no sync needed', { userId });
      return;
    }
    
    // User doesn't exist, create them using token info
    logger.logAuth(context, 'User not found in database, creating from token info', { 
      userId,
      email: userInfo.email,
    });
    
    const email = userInfo.email;
    const name = userInfo.name || email?.split('@')[0] || 'User';
    
    if (!email) {
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Token missing required email claim for user creation',
        401,
        { userId }
      );
    }
    
    // Create the user
    await query(
      `INSERT INTO users (
        id,
        email,
        name,
        preferences,
        notification_settings
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING`,
      [
        userId,
        email,
        name,
        JSON.stringify({}),
        JSON.stringify({
          emailNotifications: true,
          emailFrequency: 'immediate',
          instantNotifications: true,
          notificationEmail: email
        })
      ]
    );
    
    logger.logAuth(context, 'User synchronized to database successfully', { 
      userId,
      email
    });
  } catch (error) {
    logger.logError(context, 'Error synchronizing user', { 
      userId,
      error: error.message,
      stack: error.stack
    });
    
    // Don't throw error here, just log it
    // We don't want auth to fail if sync fails
  }
}
```

### 3. Integration with Authentication Middleware

Called the synchronization function in both the Fastify and Express-style middleware handlers after successful token verification:

```javascript
// In Fastify preHandler hook
// Synchronize user to database if necessary
try {
  await synchronizeUser(userId, 
    { 
      email: decoded.email, 
      name: decoded.name || decoded.email?.split('@')[0] || 'User' 
    }, 
    { requestId: request.id, path: request.url }
  );
} catch (syncError) {
  // Just log the error but don't fail authentication
  logger.logError({ requestId: request.id, path: request.url }, 
    `User sync error: ${syncError.message}`, { userId });
}
```

## Benefits

1. Fixed CORS errors that were preventing frontend-to-auth communication
2. Eliminated foreign key constraint errors when creating subscriptions for authenticated users
3. Ensured that any user with a valid JWT token can use the backend services, even if they were previously missing from the database
4. Maintained backward compatibility with existing code
5. Enhanced error logging for easier debugging

## Future Improvements

1. Implement a more robust user synchronization mechanism using PubSub
2. Add webhooks for user events in the authentication service
3. Consider using a shared database for both authentication and backend services
4. Add health checks to verify user synchronization is working properly