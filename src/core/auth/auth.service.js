import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';
import { getFirebaseAuth, verifyFirebaseIdToken, getFirebaseUser, getFirebaseUserByEmail } from '../../infrastructure/firebase/admin.js';
import * as logger from '../../shared/logger.js';
import { query } from '../../infrastructure/database/client.js';

class AuthService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    
    logger.logAuth({}, 'Initializing auth service with Firebase', {
      environment: this.isProduction ? 'production' : 'development',
      project: process.env.GOOGLE_CLOUD_PROJECT,
      firebaseProject: process.env.FIREBASE_PROJECT_ID
    });
  }

  /**
   * Initialize authentication service
   */
  async initialize() {
    try {
      logger.logAuth({}, 'Auth service initialized with Firebase integration');
      return true;
    } catch (error) {
      logger.logError({}, error, { context: 'Failed to initialize auth service' });
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
   * @param {string} userId - Database user ID
   * @returns {Promise<Object>} User info
   */
  async findUserById(userId) {
    const result = await query(
      'SELECT id, email, display_name, role, firebase_uid FROM users WHERE id = $1',
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
    const result = await query(
      'SELECT id, email, display_name, role, firebase_uid FROM users WHERE firebase_uid = $1',
      [firebaseUid]
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
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User info
   */
  async findUserByEmail(email) {
    const result = await query(
      'SELECT id, email, display_name, role, firebase_uid FROM users WHERE email = $1',
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