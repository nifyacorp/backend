# Firebase Authentication Integration Plan for Backend

This document outlines the plan to integrate Firebase Authentication with our backend services, enabling token verification and user management across the platform.

## 1. Overview

The implementation will use Firebase Admin SDK to verify tokens from the frontend and ensure that only authenticated users can access protected resources. This approach leverages Firebase's robust authentication mechanisms while maintaining our existing backend infrastructure.

## 2. Prerequisites

- Firebase Project created in Firebase Console
- Firebase Authentication enabled with desired providers (Email/Password, Google, etc.)
- Firebase service account credentials (JSON file)
- Secret Manager configured to store Firebase credentials

## 3. Implementation Steps

### 3.1 Install Firebase Admin SDK

```bash
# In each service that requires authentication:
npm install firebase-admin
```

### 3.2 Configure Firebase Admin SDK

Create a Firebase initialization module that will be imported by services requiring authentication:

```typescript
// src/utils/firebase-admin.ts
import * as admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Initialize Secret Manager client
const secretClient = new SecretManagerServiceClient();

async function getFirebaseConfig() {
  try {
    // Access the secret containing Firebase credentials
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/your-project-id/secrets/FIREBASE_SERVICE_ACCOUNT/versions/latest',
    });
    
    // Parse the secret data as JSON
    const serviceAccount = JSON.parse(version.payload.data.toString());
    
    return serviceAccount;
  } catch (error) {
    console.error('Error loading Firebase credentials from Secret Manager:', error);
    throw error;
  }
}

// Lazily initialized Firebase app
let firebaseApp: admin.app.App | null = null;

// Function to initialize Firebase Admin SDK
export async function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    try {
      const serviceAccount = await getFirebaseConfig();
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Optional: Configure additional Firebase services here
      });
      
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }
  
  return firebaseApp;
}

// Auth service accessor
export async function getFirebaseAuth() {
  const app = await initializeFirebaseAdmin();
  return app.auth();
}
```

### 3.3 Create Auth Middleware

Create middleware for Express to validate Firebase JWT tokens:

```typescript
// src/middleware/firebase-auth.ts
import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../utils/firebase-admin';

// Extend Request type to include user information
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
}

/**
 * Middleware to verify Firebase authentication tokens
 * 
 * Usage: app.use('/protected-routes', verifyFirebaseToken);
 * or: app.get('/some-path', verifyFirebaseToken, yourHandler);
 */
export async function verifyFirebaseToken(req: AuthRequest, res: Response, next: NextFunction) {
  // Get the ID token from the Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please provide a valid token.'
      }
    });
  }
  
  // Extract token from header
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Initialize Firebase Auth if not already done
    const auth = await getFirebaseAuth();
    
    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Add user information to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture
    };
    
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    
    // Determine the type of error and return appropriate status code
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please login again.'
        }
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Authentication token has been revoked. Please login again.'
        }
      });
    }
    
    // Default error response
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token. Please login again.'
      }
    });
  }
}

/**
 * Optional middleware to enforce specific roles or permissions
 * This is a placeholder for role-based access control
 */
export function requireRole(role: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }
    
    try {
      // Here, you would check if the user has the required role
      // This depends on how you store roles for your users
      // Example implementation:
      // const auth = await getFirebaseAuth();
      // const userRecord = await auth.getUser(req.user.uid);
      // const customClaims = userRecord.customClaims || {};
      // if (customClaims.role !== role) throw new Error('Insufficient permissions');
      
      next();
    } catch (error) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Required role: ${role}`
        }
      });
    }
  };
}
```

### 3.4 Integrate with Existing User Database

Create a service to sync Firebase users with our database:

```typescript
// src/services/user-service.ts
import { getFirebaseAuth } from '../utils/firebase-admin';
import { db } from '../database'; // Your database connection

interface User {
  id: string;
  email: string;
  name?: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  firebase_uid: string;
}

export async function findOrCreateUser(firebaseUid: string) {
  try {
    // First, check if the user already exists in our database
    const existingUser = await db.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (existingUser.rowCount > 0) {
      return existingUser.rows[0];
    }
    
    // If user doesn't exist, fetch details from Firebase
    const auth = await getFirebaseAuth();
    const firebaseUser = await auth.getUser(firebaseUid);
    
    // Create new user in our database
    const newUser = await db.query(
      `INSERT INTO users 
       (email, name, email_verified, firebase_uid, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [
        firebaseUser.email,
        firebaseUser.displayName || null,
        firebaseUser.emailVerified,
        firebaseUser.uid
      ]
    );
    
    return newUser.rows[0];
  } catch (error) {
    console.error('Error synchronizing user data:', error);
    throw error;
  }
}

export async function updateUserProfile(firebaseUid: string, userData: Partial<User>) {
  // Implementation to update user data in our database
  // ...
}
```

### 3.5 Update API Routes

Apply the Firebase authentication middleware to existing routes:

```typescript
// src/routes/api.ts
import express from 'express';
import { verifyFirebaseToken, requireRole } from '../middleware/firebase-auth';
import { userController } from '../controllers/user-controller';
import { subscriptionController } from '../controllers/subscription-controller';

const router = express.Router();

// Public routes
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);

// Protected routes - require authentication
router.use('/users', verifyFirebaseToken);
router.use('/subscriptions', verifyFirebaseToken);
router.use('/notifications', verifyFirebaseToken);

// User routes
router.get('/users/me', userController.getCurrentUser);
router.put('/users/me', userController.updateCurrentUser);

// Admin routes - require specific role
router.use('/admin', verifyFirebaseToken, requireRole('admin'));
router.get('/admin/users', userController.getAllUsers);

export default router;
```

### 3.6 Update Database Schema

Modify the users table to include Firebase UID:

```sql
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) UNIQUE;
```

## 4. User Migration Strategy

For existing users, we need to create corresponding Firebase users:

1. **Create Script:** Develop a migration script to create Firebase users for existing database users:

```typescript
// scripts/migrate-users-to-firebase.ts
import * as admin from 'firebase-admin';
import { db } from '../src/database';
import { getFirebaseAuth } from '../src/utils/firebase-admin';

async function migrateUsers() {
  try {
    // Get all users from the database
    const result = await db.query('SELECT * FROM users WHERE firebase_uid IS NULL');
    const usersToMigrate = result.rows;
    
    console.log(`Found ${usersToMigrate.length} users to migrate to Firebase`);
    
    const auth = await getFirebaseAuth();
    
    for (const user of usersToMigrate) {
      try {
        // Check if user already exists in Firebase
        try {
          const firebaseUser = await auth.getUserByEmail(user.email);
          console.log(`User ${user.email} already exists in Firebase with UID: ${firebaseUser.uid}`);
          
          // Update our database with the Firebase UID
          await db.query(
            'UPDATE users SET firebase_uid = $1 WHERE id = $2',
            [firebaseUser.uid, user.id]
          );
          
          continue;
        } catch (error) {
          // User doesn't exist in Firebase, proceed with creation
          if (error.code !== 'auth/user-not-found') throw error;
        }
        
        // Create user in Firebase
        const userRecord = await auth.createUser({
          email: user.email,
          emailVerified: user.email_verified || false,
          displayName: user.name,
          // Note: Cannot migrate passwords directly to Firebase
          // Need to set a temporary password or use passwordHash if Firebase supports it
          password: `temp-${Math.random().toString(36).substring(2, 12)}`
        });
        
        console.log(`Created Firebase user for ${user.email} with UID: ${userRecord.uid}`);
        
        // Update our database with the Firebase UID
        await db.query(
          'UPDATE users SET firebase_uid = $1 WHERE id = $2',
          [userRecord.uid, user.id]
        );
        
        // Optional: Send password reset email to allow user to set their password
        await auth.generatePasswordResetLink(user.email);
      } catch (error) {
        console.error(`Failed to migrate user ${user.email}:`, error);
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateUsers().catch(console.error);
```

2. **Communication Plan:** Inform users about the authentication changes and guide them through the password reset process.

## 5. Testing Strategy

1. **Unit Tests:** Test middleware for token verification with mock tokens
2. **Integration Tests:** Verify end-to-end authentication flow from frontend to backend 
3. **Manual Testing:** Test various authentication scenarios:
   - Login with email/password
   - Login with Google
   - Token expiration and refresh
   - Access to protected routes
   - Unauthorized access attempts

## 6. Deployment Plan

1. **Database Updates:** Deploy database schema changes
2. **Backend Services:** Deploy updates to all backend services
3. **Configuration:** Set up Firebase credentials in Secret Manager for all environments
4. **Migration:** Run the user migration script with careful monitoring
5. **Staged Rollout:** Enable Firebase authentication for a percentage of users initially
6. **Full Deployment:** Switch all users to Firebase authentication

## 7. Fallback Plan

In case of issues during the transition to Firebase Authentication:

1. Keep the existing authentication system operational during testing and initial rollout
2. Implement a toggle mechanism to switch between authentication systems
3. Have a rollback plan if critical issues are discovered

## 8. Security Considerations

1. **Token Storage:** Ensure proper token storage in the frontend (httpOnly cookies or localStorage with precautions)
2. **Expiration:** Set appropriate expiration times for tokens
3. **Secret Management:** Secure storage of Firebase service account credentials
4. **CORS:** Configure proper CORS settings to prevent token leakage
5. **Rate Limiting:** Implement rate limiting for authentication endpoints

## 9. Timeline

| Phase | Description | Estimated Duration |
|-------|-------------|-------------------|
| Setup | Firebase project setup and configuration | 1 day |
| Backend Development | Implement Firebase Admin SDK integration | 3-4 days |
| Database Updates | Update schema and create migration tools | 1-2 days |
| User Migration | Migrate existing users to Firebase | 1-2 days |
| Testing | Comprehensive testing of auth flows | 2-3 days |
| Deployment | Staged rollout to production | 2-3 days |

Total Estimated Time: 10-15 days 