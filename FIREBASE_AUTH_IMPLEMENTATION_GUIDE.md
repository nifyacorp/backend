# Firebase Authentication Implementation Guide for Backend

This guide focuses on the specific code changes needed to integrate Firebase Authentication in the backend service.

## 1. Install Firebase Admin SDK

```bash
npm install firebase-admin
```

## 2. Create Firebase Admin Initialization Module

Create a file at `src/infrastructure/firebase/admin.js`:

```javascript
import * as admin from 'firebase-admin';

// Singleton instance
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    try {
      // Initialize with application default credentials when running on GCP
      // The service account is auto-detected when deployed to GCP
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      
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

## 3. Create Firebase Authentication Middleware

Create a file at `src/interfaces/http/middleware/firebase-auth.middleware.js`:

```javascript
import { AppError } from '../../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../../../core/types/auth.types.js';
import { getFirebaseAuth } from '../../../infrastructure/firebase/admin.js';
import logger from '../../../shared/logger.js';

// Define public paths that don't require authentication
const PUBLIC_PATHS = [
  '/health',
  '/documentation',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/initOAuth',
  '/documentation/static'
];

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
        401
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
          401
        );
      }
      
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Invalid authentication token. Please log in again.',
        401
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
```

## 4. Update `.env` File with Firebase Configuration

Add the Firebase configuration to your `.env` file:

```
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-auth-domain
FIREBASE_STORAGE_BUCKET=your-storage-bucket
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## 5. Replace Current Auth Middleware in App Setup

Update your application setup file:

### For Fastify apps:

```javascript
// src/app.js or similar
import { firebaseAuthenticate } from './interfaces/http/middleware/firebase-auth.middleware.js';

// Replace the current auth middleware with Firebase auth
app.addHook('preHandler', firebaseAuthenticate);
```

### For Express apps:

```javascript
// src/app.js or similar
import { firebaseAuthMiddleware } from './interfaces/http/middleware/firebase-auth.middleware.js';

// Replace the current auth middleware with Firebase auth
app.use(firebaseAuthMiddleware);
```

## 6. Update Database Schema (If Required)

If your database needs a Firebase UID column, run this SQL:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
```

## 7. Update Auth Service Implementation (Optional)

If you have an existing auth service, update it to use Firebase:

```javascript
// src/core/auth/auth.service.js
import { getFirebaseAuth } from '../../infrastructure/firebase/admin.js';

export const authService = {
  /**
   * Verify Firebase ID token
   */
  async verifyToken(token) {
    const auth = getFirebaseAuth();
    return await auth.verifyIdToken(token);
  },
  
  /**
   * Get user by ID from Firebase
   */
  async getUserById(uid) {
    const auth = getFirebaseAuth();
    return await auth.getUser(uid);
  }
};
```

## 8. Test Firebase Authentication

Create a simple test endpoint to verify the integration is working:

```javascript
// src/interfaces/http/routes/auth.routes.js
import { Router } from 'express';
import { firebaseAuthMiddleware } from '../middleware/firebase-auth.middleware.js';

const router = Router();

// Public route - no auth required
router.get('/public', (req, res) => {
  res.json({ message: 'This is a public endpoint' });
});

// Protected route - requires Firebase auth
router.get('/protected', firebaseAuthMiddleware, (req, res) => {
  res.json({ 
    message: 'This is a protected endpoint',
    user: req.user
  });
});

export default router;
```

## 9. Handling Frontend Integration

The frontend should:

1. Use Firebase SDK to authenticate users
2. Include the Firebase ID token in the Authorization header for API requests:

```javascript
// Example frontend code
const makeAuthenticatedRequest = async (url) => {
  const user = firebase.auth().currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const token = await user.getIdToken();
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

## 10. Deployment Checklist

Before deploying to production:

1. Verify Firebase Admin SDK is correctly initialized
2. Ensure environment variables are set in your deployment environment
3. Confirm authentication middleware is correctly integrated
4. Test authentication flow from frontend to backend
5. Verify token expiration handling works correctly
6. Check error responses are properly formatted

## 11. Troubleshooting

Common issues and solutions:

1. **Invalid token errors**
   - Ensure tokens are correctly passed from frontend
   - Check token format in Authorization header
   - Verify Firebase project configuration

2. **Firebase Admin SDK initialization errors**
   - Confirm environment variables are correctly set
   - Check GCP service account permissions

3. **CORS issues**
   - Configure proper CORS settings for your frontend domains

4. **Token expiration issues**
   - Implement token refresh logic in the frontend
</rewritten_file> 