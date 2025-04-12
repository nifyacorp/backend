import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';
import { getFirebaseAuth, verifyFirebaseIdToken, getFirebaseUser, getFirebaseUserByEmail } from '../../infrastructure/firebase/admin.js';
import * as logger from '../../shared/logger.js';
import { query } from '../../infrastructure/database/client.js';

class AuthService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Initialize authentication service
   */
  async initialize() {
    try {
      logger.logAuth({}, 'Application auth service initialized and ready');
      return true;
    } catch (error) {
      logger.logError({}, error, { context: 'Failed to initialize application auth service' });
      throw error;
    }
  }

  /**
   * Verify Firebase ID token and sync user to database
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object>} User info
   */
  async verifyToken(token) {
    try {
      // Verify token with Firebase
      const decodedToken = await verifyFirebaseIdToken(token);
      
      // Look up user in database by Firebase UID
      const userResult = await query(
        'SELECT id, email, display_name, role FROM users WHERE firebase_uid = $1',
        [decodedToken.uid]
      );
      
      // If user exists in Firebase but not in our database, create them
      if (userResult.rowCount === 0) {
        // Get user details from Firebase
        const firebaseUser = await getFirebaseUser(decodedToken.uid);
        
        // Create user in our database
        const newUserResult = await query(
          `INSERT INTO users (
            email, 
            display_name, 
            firebase_uid, 
            role, 
            metadata
          ) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, display_name, role`,
          [
            firebaseUser.email,
            firebaseUser.displayName || firebaseUser.email.split('@')[0],
            firebaseUser.uid,
            'user',
            JSON.stringify({
              source: 'firebase',
              email_verified: firebaseUser.emailVerified || false
            })
          ]
        );
        
        // Return new user
        return {
          id: newUserResult.rows[0].id,
          email: newUserResult.rows[0].email,
          display_name: newUserResult.rows[0].display_name,
          role: newUserResult.rows[0].role,
          firebase_uid: decodedToken.uid
        };
      }
      
      // Return existing user
      return {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        display_name: userResult.rows[0].display_name,
        role: userResult.rows[0].role,
        firebase_uid: decodedToken.uid
      };
    } catch (error) {
      logger.logError({}, error, { context: 'Token verification failed' });
      
      // Map Firebase error codes to our error types
      if (error.code === 'auth/id-token-expired') {
        throw new AppError(
          AUTH_ERRORS.TOKEN_EXPIRED.code,
          AUTH_ERRORS.TOKEN_EXPIRED.message,
          401
        );
      }
      
      if (error.code === 'auth/id-token-revoked') {
        throw new AppError(
          AUTH_ERRORS.TOKEN_REVOKED.code,
          AUTH_ERRORS.TOKEN_REVOKED.message,
          401
        );
      }
      
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        error.message || 'Invalid authentication token',
        401
      );
    }
  }
  
  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User info
   */
  async findUserById(userId) {
    const result = await query(
      'SELECT id, email, display_name, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      throw new AppError(
        'USER_NOT_FOUND',
        'User not found',
        404
      );
    }
    
    return result.rows[0];
  }
  
  /**
   * Find user by Firebase UID
   * @param {string} firebaseUid - Firebase user ID
   * @returns {Promise<Object>} User info
   */
  async findUserByFirebaseUid(firebaseUid) {
    // In our new schema, firebase UID is directly stored as the primary key (id)
    return this.findUserById(firebaseUid);
  }
  
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User info
   */
  async findUserByEmail(email) {
    const result = await query(
      'SELECT id, email, display_name, role FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rowCount === 0) {
      throw new AppError(
        'USER_NOT_FOUND',
        'User not found',
        404
      );
    }
    
    return result.rows[0];
  }
  
  /**
   * Get a Firebase user by ID
   * @param {string} uid - Firebase user ID
   * @returns {Promise<Object>} User information
   */
  async getUserById(uid) {
    try {
      const auth = getFirebaseAuth();
      return await auth.getUser(uid);
    } catch (error) {
      logger.logError({}, error, { context: 'Error getting user from Firebase' });
      throw new AppError(
        'USER_NOT_FOUND',
        'User not found',
        404
      );
    }
  }
  
  /**
   * Get a Firebase user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} Firebase user information
   */
  async getUserByEmail(email) {
    try {
      return await getFirebaseUserByEmail(email);
    } catch (error) {
      logger.logError({}, error, { context: 'Error getting user from Firebase by email' });
      throw new AppError(
        'USER_NOT_FOUND',
        'User not found',
        404
      );
    }
  }
}

export const authService = new AuthService();

/**
 * Synchronizes a Firebase authenticated user with our application's database.
 * This function is used by the /v1/users/sync endpoint.
 *
 * @param {string} firebaseUid - Firebase UID of the user
 * @param {Object} context - Request context for logging
 * @returns {Promise<Object>} User profile object
 */
export async function syncFirebaseUser(firebaseUid, context) {
  try {
    // Get user information from Firebase
    const auth = getFirebaseAuth();
    const firebaseUser = await auth.getUser(firebaseUid);
    
    if (!firebaseUser) {
      throw new Error(`Firebase user with UID ${firebaseUid} not found`);
    }

    logger.logAuth(context, 'Looking up user in database', { firebaseUid });

    // Check if the user exists in our database - using firebaseUid as the primary key directly
    const userCheckResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [firebaseUid]
    );
    
    let userId = null;
    let isNewUser = false;
    
    if (userCheckResult.rows.length > 0) {
      // User exists, update their record with any new information
      userId = userCheckResult.rows[0].id;
      
      logger.logAuth(context, 'User found in database', { 
        userId, 
        firebaseUid 
      });
      
      // Update user information
      await query(
        `UPDATE users SET
          email = $1,
          display_name = $2,
          updated_at = NOW(),
          metadata = jsonb_set(
            jsonb_set(
              coalesce(metadata, '{}'::jsonb),
              '{emailVerified}',
              $3::text::jsonb
            ),
            '{lastLogin}',
            $4::text::jsonb
          )
        WHERE id = $5`,
        [
          firebaseUser.email,
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          JSON.stringify(firebaseUser.emailVerified || false),
          JSON.stringify(new Date().toISOString()),
          firebaseUid
        ]
      );
      
      logger.logAuth(context, 'User updated', { userId, firebaseUid });
    } else {
      // Create new user in the database using Firebase UID as primary key
      isNewUser = true;
      
      logger.logAuth(context, 'User not found, creating new user record', { 
        firebaseUid, 
        email: firebaseUser.email 
      });
      
      const createResult = await query(
        `INSERT INTO users (
          id,
          email, 
          display_name, 
          metadata
        ) VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [
          firebaseUid, // Using Firebase UID as primary key
          firebaseUser.email,
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          JSON.stringify({
            emailVerified: firebaseUser.emailVerified || false,
            lastLogin: new Date().toISOString(),
            emailNotifications: true,
            emailFrequency: 'immediate',
            instantNotifications: true,
            notificationEmail: firebaseUser.email,
            avatar: firebaseUser.photoURL || null
          })
        ]
      );
      
      userId = createResult.rows[0].id;
      
      logger.logAuth(context, 'New user created successfully', { 
        userId, 
        firebaseUid 
      });
    }
    
    // Get and return the full user profile
    logger.logAuth(context, 'Retrieving user profile for return', { userId });
    
    const profileResult = await query(
      `SELECT 
        id,
        email,
        display_name as name,
        metadata->>'avatar' as avatar,
        metadata->>'emailVerified' as "emailVerified",
        metadata->>'lastLogin' as "lastLogin",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users
      WHERE id = $1`,
      [userId]
    );
    
    // Convert string boolean to actual boolean
    const profile = profileResult.rows[0];
    profile.emailVerified = profile.emailVerified === 'true';
    
    logger.logAuth(context, 'User sync completed successfully', { 
      userId, 
      firebaseUid,
      isNewUser 
    });
    
    return {
      success: true,
      profile,
      isNewUser
    };
  } catch (error) {
    logger.logError(context, 'Error in syncFirebaseUser:', { 
      error: error.message,
      stack: error.stack,
      firebaseUid
    });
    throw error;
  }
}