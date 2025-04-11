import jwt from 'jsonwebtoken';
import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';
import { getFirebaseAuth, verifyFirebaseIdToken, getFirebaseUser } from '../../infrastructure/firebase/admin.js';
import logger from '../../shared/logger.js';
import { query } from '../../infrastructure/database/client.js';
import { getSecret, initialize as initializeSecrets } from '../../infrastructure/secrets/manager.js';

class AuthService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.JWT_SECRET = null;
    this.JWT_REFRESH_SECRET = null;
    
    // Token expiration settings
    this.accessTokenExpiration = '15m';  // 15 minutes
    this.refreshTokenExpiration = '7d';  // 7 days
    
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
      // Initialize legacy JWT secrets for backward compatibility
      await this.initializeLegacy();
      logger.logAuth({}, 'Auth service initialized with Firebase integration');
      return true;
    } catch (error) {
      logger.logError({}, 'Failed to initialize auth service', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify user token
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
      logger.logError({}, 'Token verification failed', {
        error: error.message,
        code: error.code
      });
      
      throw new AppError(
        'AUTHENTICATION_ERROR',
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
   * Verify a token using Firebase
   * This is the primary token verification method
   * 
   * @param {string} token - The token to verify
   * @param {boolean} isRefreshToken - Whether this is a refresh token (legacy only)
   * @returns {Promise<object>} The decoded token payload
   */
  async verifyTokenLegacy(token, isRefreshToken = false) {
    try {
      // First try to verify with Firebase (primary method)
      try {
        const auth = getFirebaseAuth();
        const decodedToken = await auth.verifyIdToken(token);
        
        logger.logAuth({}, 'Firebase token verified successfully', { 
          uid: decodedToken.uid, 
          email: decodedToken.email
        });
        
        // Map Firebase token fields to our standard format for compatibility
        return {
          sub: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name,
          email_verified: decodedToken.email_verified,
          type: 'access' // All Firebase tokens are treated as access tokens
        };
      } catch (firebaseError) {
        // If Firebase verification fails with a specific error, throw it directly
        if (firebaseError.code === 'auth/id-token-expired') {
          throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
        }
        
        // For other Firebase-specific errors, throw as invalid token
        if (firebaseError.code) {
          throw new AppError(
            AUTH_ERRORS.INVALID_TOKEN.code,
            `Firebase authentication failed: ${firebaseError.message}`,
            401
          );
        }
        
        // If the error isn't Firebase-specific, fall back to legacy JWT verification
        logger.logAuth({}, 'Firebase verification failed, falling back to legacy JWT', { 
          error: firebaseError.message 
        });
        
        // Continue to legacy verification below
      }
      
      // Legacy JWT verification (will be removed in future)
      // This is kept for backward compatibility during migration
      
      // Get the right secret based on token type
      const tokenType = isRefreshToken ? 'refresh' : 'access';
      const secretToUse = isRefreshToken ? this.JWT_REFRESH_SECRET : this.JWT_SECRET;
      
      if (!secretToUse) {
        await this.initialize();
      }
      
      try {
        // First decode without verification to check structure
        const decodedHeader = jwt.decode(token, { complete: true });
        
        // Verify with the appropriate secret based on token type
        const decoded = jwt.verify(token, secretToUse);
        
        // Additional validation for token type
        const expectedType = isRefreshToken ? 'refresh' : 'access';
        if (decoded.type !== expectedType) {
          throw new AppError(
            AUTH_ERRORS.INVALID_TOKEN.code,
            `Invalid token type: Expected ${expectedType} token`,
            401
          );
        }
        
        if (!decoded || !decoded.sub) {
          throw new AppError(
            AUTH_ERRORS.INVALID_TOKEN.code,
            'Invalid token format: missing sub claim',
            401
          );
        }
        
        return decoded;
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw new AppError('TOKEN_EXPIRED', `${tokenType.charAt(0).toUpperCase() + tokenType.slice(1)} token has expired`, 401);
        }
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          AUTH_ERRORS.INVALID_TOKEN.code,
          `Invalid ${tokenType} token: ${error.message}`,
          401,
          { originalError: error.message, tokenType }
        );
      }
    } catch (error) {
      // Pass through AppErrors
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap other errors
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        error.message || 'Invalid token',
        401
      );
    }
  }

  /**
   * Initialize legacy JWT secrets
   * Only used for backward compatibility during migration
   */
  async initializeLegacy() {
    try {
      // Initialize secrets manager first
      await initializeSecrets();
      
      // Get JWT secrets from Secret Manager
      this.JWT_SECRET = await getSecret('JWT_SECRET');
      
      try {
        this.JWT_REFRESH_SECRET = await getSecret('JWT_REFRESH_SECRET');
      } catch (refreshError) {
        // Fall back to main secret if refresh secret is not available
        logger.logInfo({}, 'JWT_REFRESH_SECRET not found, falling back to JWT_SECRET');
        this.JWT_REFRESH_SECRET = this.JWT_SECRET;
      }
      
      logger.logAuth({}, 'JWT secrets loaded successfully');
    } catch (error) {
      logger.logError({}, 'Failed to load JWT secrets', { 
        error: error.message
      });
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'Authentication service unavailable: Could not load secrets',
        500
      );
    }
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
      logger.logError({}, 'Error getting user from Firebase', { 
        uid, 
        error: error.message 
      });
      throw new AppError(
        'USER_NOT_FOUND',
        'User not found',
        404
      );
    }
  }
  
  /**
   * Legacy method to generate a new access token using a refresh token
   * This is kept for backward compatibility during migration
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyTokenLegacy(refreshToken, true);
      
      // Generate a new access token
      const accessToken = jwt.sign(
        {
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          email_verified: decoded.email_verified,
          type: 'access'
        },
        this.JWT_SECRET,
        { expiresIn: this.accessTokenExpiration }
      );
      
      // Return the new access token
      return {
        accessToken,
        user: {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          email_verified: decoded.email_verified
        }
      };
    } catch (error) {
      logger.logError({}, 'Error refreshing access token', {
        error: error.message,
        name: error.name,
      });
      
      // Re-throw AppErrors
      if (error instanceof AppError) {
        throw error;
      }
      
      // Otherwise, wrap in an AppError
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Invalid refresh token',
        401,
        { originalError: error.message }
      );
    }
  }
}

export const authService = new AuthService();