# Firebase Authentication Implementation Plan for Backend

## 1. Overview

This plan outlines the steps to replace our current authentication system with Firebase Authentication in the backend services. The frontend already has Firebase Authentication set up, and now we need to properly integrate it with our backend.

## 2. Current Authentication System

The current authentication system uses a custom JWT verification process with a secret. This approach is being replaced due to issues with the implementation.

## 3. Implementation Steps

### 3.1 Install Required Dependencies

```bash
npm install firebase-admin
```

### 3.2 Firebase Admin SDK Configuration

Create a Firebase Admin SDK initialization utility:

```typescript
// src/infrastructure/firebase/admin.ts
import * as admin from 'firebase-admin';

// Singleton instance
let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account from environment variables or JSON file
 */
export function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    try {
      // If service account is provided as JSON string in environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } 
      // If running in GCP environment with default credentials
      else if (process.env.GCP_PROJECT) {
        firebaseApp = admin.initializeApp({
          projectId: process.env.GCP_PROJECT
        });
      }
      // If service account file path is provided
      else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      else {
        throw new Error('Firebase configuration missing. Set FIREBASE_SERVICE_ACCOUNT environment variable.');
      }
      
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }
  
  return firebaseApp;
}

/**
 * Get Firebase Auth service
 */
export function getFirebaseAuth() {
  const app = initializeFirebaseAdmin();
  return app.auth();
}
```

### 3.3 Authentication Middleware Implementation

Create a Firebase authentication middleware to replace the current one:

```typescript
// src/interfaces/http/middleware/firebase-auth.middleware.ts
import { AppError } from '../../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { getFirebaseAuth } from '../../../infrastructure/firebase/admin.js';
import logger from '../../../shared/logger.js';
import { AUTH_HEADER, PUBLIC_PATHS } from '../../../shared/constants/headers.js';

/**
 * Firebase Authentication Middleware for Fastify
 */
export async function firebaseAuthenticate(request, reply) {
  try {
    // Skip authentication for public paths
    if (PUBLIC_PATHS.some(path => request.url.startsWith(path))) {
      return;
    }
    
    // Extract authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.match(/^bearer\s+.+$/i)) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Authorization header is required and must be in format: Bearer <token>',
        401
      );
    }
    
    // Extract token
    const token = authHeader.replace(/^bearer\s+/i, '');
    
    if (!token) {
      throw new AppError(
        AUTH_ERRORS.MISSING_HEADERS.code,
        'Invalid token format',
        401,
        { missingToken: true }
      );
    }
    
    try {
      // Verify Firebase token
      const auth = getFirebaseAuth();
      const decodedToken = await auth.verifyIdToken(token);
      
      // Set user info on request
      request.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        token: decodedToken
      };
      
      // Add token info to userContext for other services
      request.userContext = {
        token: {
          sub: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name
        }
      };
      
      // Optional: Synchronize user with database
      try {
        await synchronizeUser(decodedToken.uid, 
          { 
            email: decodedToken.email, 
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
            email_verified: decodedToken.email_verified
          }, 
          { requestId: request.id, path: request.url }
        );
      } catch (syncError) {
        // Log error but don't fail authentication
        logger.logError({ requestId: request.id, path: request.url }, 
          `User sync error: ${syncError.message}`, { userId: decodedToken.uid });
      }
      
      logger.logInfo({ 
        requestId: request.id, 
        path: request.url 
      }, 'Authentication successful', { userId: decodedToken.uid });
    } catch (verifyError) {
      logger.logError({ 
        requestId: request.id, 
        path: request.url 
      }, 'Token verification failed', { error: verifyError.message, code: verifyError.code });
      
      // Map Firebase error codes to our error types
      if (verifyError.code === 'auth/id-token-expired') {
        throw new AppError(
          'TOKEN_EXPIRED',
          'Your session has expired. Please log in again.',
          401,
          { originalError: verifyError.message }
        );
      }
      
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Invalid authentication token. Please log in again.',
        401,
        { originalError: verifyError.message }
      );
    }
  } catch (error) {
    logger.logError({
      requestId: request.id,
      path: request.url
    }, 'Authentication error', { 
      errorName: error.name,
      errorMessage: error.message, 
      errorCode: error.code
    });
    
    // Return error response
    const errorResponse = {
      status: 'error',
      code: error.code || 'UNAUTHORIZED',
      message: error.message || 'Authentication required'
    };
    
    reply.code(401).send(errorResponse);
  }
}

/**
 * Express-style middleware for Firebase authentication
 */
export const firebaseAuthMiddleware = async (request, response, next) => {
  try {
    // Skip authentication for public paths
    if (PUBLIC_PATHS.some(path => request.url.startsWith(path))) {
      return next();
    }
    
    // Extract authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return response.status(401).json({
        status: 'error',
        code: AUTH_ERRORS.MISSING_HEADERS.code,
        message: 'Authorization header is required'
      });
    }
    
    if (!authHeader.match(/^bearer\s+.+$/i)) {
      return response.status(401).json({
        status: 'error',
        code: AUTH_ERRORS.MISSING_HEADERS.code,
        message: 'Invalid Authorization header format. Must be: Bearer <token>'
      });
    }
    
    const token = authHeader.replace(/^bearer\s+/i, '');
    
    if (!token) {
      return response.status(401).json({
        status: 'error',
        code: AUTH_ERRORS.MISSING_HEADERS.code,
        message: 'Invalid token format'
      });
    }
    
    try {
      // Verify Firebase token
      const auth = getFirebaseAuth();
      const decodedToken = await auth.verifyIdToken(token);
      
      // Set user info on request
      request.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        token: decodedToken
      };
      
      // Optional: Synchronize user with database
      try {
        await synchronizeUser(decodedToken.uid, 
          { 
            email: decodedToken.email, 
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
            email_verified: decodedToken.email_verified
          }, 
          { requestId: request.headers['x-request-id'] || 'unknown', path: request.url }
        );
      } catch (syncError) {
        console.error('User sync error:', syncError.message);
      }
      
      // Add token info to userContext for other services
      request.userContext = {
        token: {
          sub: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name
        }
      };
      
      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      
      // Map Firebase error codes to our error types
      if (verifyError.code === 'auth/id-token-expired') {
        return response.status(401).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.'
        });
      }
      
      return response.status(401).json({
        status: 'error',
        code: AUTH_ERRORS.INVALID_TOKEN.code,
        message: verifyError.message || 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return response.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication error'
    });
  }
};

/**
 * Synchronize Firebase user with database
 */
async function synchronizeUser(uid, userData, requestContext) {
  // Implementation will depend on your database setup
  // This will create or update user record in your database
  // to maintain consistency between Firebase and your application
  
  // Example implementation:
  // const userExists = await db.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
  // 
  // if (!userExists.rows.length) {
  //   await db.query(
  //     'INSERT INTO users (email, name, email_verified, firebase_uid, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
  //     [userData.email, userData.name, userData.email_verified, uid]
  //   );
  // } else {
  //   await db.query(
  //     'UPDATE users SET email = $1, name = $2, email_verified = $3, updated_at = NOW() WHERE firebase_uid = $4',
  //     [userData.email, userData.name, userData.email_verified, uid]
  //   );
  // }
}
```

### 3.4 Update Database Schema

Add Firebase UID to users table:

```sql
-- Add to existing users migration or create a new migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
```

### 3.5 Update Environment Configuration

Update `.env` and `.env.example` files:

```
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...} 
# or use FIREBASE_SERVICE_ACCOUNT_PATH for file-based config
# FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
```

### 3.6 Replace Current Auth Middleware

In the application setup file, replace the current auth middleware with the Firebase one:

```typescript
// src/index.js or src/app.js
import { firebaseAuthenticate } from './interfaces/http/middleware/firebase-auth.middleware.js';

// For Fastify
app.addHook('preHandler', firebaseAuthenticate);

// For Express-based parts of the app
app.use(firebaseAuthMiddleware);
```

### 3.7 User Migration

Create a script to migrate existing users to Firebase:

```typescript
// scripts/migrate-users-to-firebase.js
import { getFirebaseAuth } from '../src/infrastructure/firebase/admin.js';
import { query } from '../src/infrastructure/database/client.js';

async function migrateUsersToFirebase() {
  try {
    // Get users without Firebase UID
    const result = await query(
      'SELECT id, email, name, email_verified FROM users WHERE firebase_uid IS NULL'
    );
    
    const users = result.rows;
    console.log(`Found ${users.length} users to migrate to Firebase`);
    
    const auth = getFirebaseAuth();
    
    for (const user of users) {
      try {
        // Check if user already exists in Firebase
        try {
          const firebaseUser = await auth.getUserByEmail(user.email);
          console.log(`User ${user.email} already exists in Firebase with UID: ${firebaseUser.uid}`);
          
          // Update user with Firebase UID
          await query(
            'UPDATE users SET firebase_uid = $1 WHERE id = $2',
            [firebaseUser.uid, user.id]
          );
          
          continue;
        } catch (error) {
          // User doesn't exist in Firebase, proceed with creation
          if (error.code !== 'auth/user-not-found') throw error;
        }
        
        // Generate random password for new Firebase user
        // Note: In production, consider sending password reset emails
        const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        
        // Create user in Firebase
        const userRecord = await auth.createUser({
          email: user.email,
          emailVerified: user.email_verified || false,
          displayName: user.name,
          password: tempPassword
        });
        
        console.log(`Created Firebase user for ${user.email} with UID: ${userRecord.uid}`);
        
        // Update user with Firebase UID
        await query(
          'UPDATE users SET firebase_uid = $1 WHERE id = $2',
          [userRecord.uid, user.id]
        );
        
        // Send password reset email to allow user to set their password
        await auth.generatePasswordResetLink(user.email);
      } catch (error) {
        console.error(`Failed to migrate user ${user.email}:`, error);
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrateUsersToFirebase();
```

## 4. Testing Strategy

1. **Unit Testing**
   - Create unit tests for Firebase token verification
   - Test middleware functions with mocked tokens

2. **Integration Testing**
   - Test complete authentication flow with real Firebase tokens
   - Test token expiration and invalid token handling

3. **Manual Testing Checklist**
   - Test login flow from frontend to backend
   - Test token verification for API endpoints
   - Test expired token handling
   - Test invalid token handling
   - Test user synchronization with database

## 5. Deployment Plan

1. **Preparation Phase**
   - Create Firebase project (if not already done)
   - Configure Firebase Authentication in Firebase Console
   - Obtain Firebase service account credentials

2. **Database Updates**
   - Deploy database schema changes to add firebase_uid column

3. **Code Deployment**
   - Deploy updated backend with Firebase authentication support
   - Configure environment variables with Firebase credentials

4. **User Migration**
   - Run migration script to create Firebase users for existing users
   - Monitor migration process and fix any issues

5. **Switchover**
   - Switch to Firebase authentication for all endpoints
   - Monitor application for any authentication-related issues

## 6. Fallback Plan

If issues occur with Firebase authentication:

1. Implement a feature flag to switch between Firebase and legacy authentication
2. Keep the legacy authentication code available during the transition
3. Prepare rollback scripts if needed

## 7. Security Considerations

1. **Token Handling**
   - Store Firebase tokens securely in frontend (httpOnly cookies preferred)
   - Verify tokens on every API request
   - Configure appropriate token expiration times

2. **Service Account**
   - Store Firebase service account credentials securely
   - Use Secret Manager or environment variables to manage credentials
   - Limit service account permissions to only what's needed

3. **CORS Configuration**
   - Configure CORS properly to prevent token leakage
   - Only allow requests from trusted domains

## 8. Timeline

| Task | Estimated Duration |
|------|-------------------|
| Firebase Admin SDK Integration | 1 day |
| Authentication Middleware Implementation | 2 days |
| Database Schema Updates | 0.5 day |
| User Migration Script | 1 day |
| Testing | 2 days |
| Deployment | 1 day |

**Total**: Approximately 7.5 days 