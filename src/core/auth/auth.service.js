import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';

class AuthService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.secretClient = this.isProduction ? new SecretManagerServiceClient() : null;
    this.JWT_SECRET = null;
    this.JWT_REFRESH_SECRET = null;
    this.secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/JWT_SECRET/versions/latest`;
    this.refreshSecretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/JWT_REFRESH_SECRET/versions/latest`;
    
    // Token expiration settings
    this.accessTokenExpiration = '15m';  // 15 minutes
    this.refreshTokenExpiration = '7d';  // 7 days
    
    console.log('🔐 Initializing auth service:', {
      environment: this.isProduction ? 'production' : 'development',
      project: process.env.GOOGLE_CLOUD_PROJECT,
      hasSecretClient: !!this.secretClient,
      timestamp: new Date().toISOString()
    });
  }

  async initialize() {
    // For local development, use the JWT_SECRET from environment variables
    if (!this.isProduction) {
      console.log('📦 Using local JWT secrets for development');
      
      if (!process.env.JWT_SECRET) {
        throw new AppError(
          AUTH_ERRORS.SECRET_ERROR.code,
          'JWT_SECRET environment variable is required in development mode',
          500
        );
      }
      
      this.JWT_SECRET = process.env.JWT_SECRET;
      
      // For refresh tokens, use the same secret if refresh secret is not provided
      this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      
      console.log('✅ Local JWT secrets loaded successfully', {
        secretLength: this.JWT_SECRET.length,
        hasRefreshSecret: !!this.JWT_REFRESH_SECRET,
        timestamp: new Date().toISOString()
      });
      
      return;
    }
    
    try {
      console.log('📦 Fetching JWT secrets from Secret Manager...');
      
      // Fetch access token secret
      const [accessVersion] = await this.secretClient.accessSecretVersion({
        name: this.secretName
      });
      
      this.JWT_SECRET = accessVersion.payload.data.toString();
      
      try {
        // Try to fetch refresh token secret
        const [refreshVersion] = await this.secretClient.accessSecretVersion({
          name: this.refreshSecretName
        });
        
        this.JWT_REFRESH_SECRET = refreshVersion.payload.data.toString();
      } catch (refreshError) {
        // If refresh secret is not available, use the same secret as access token
        console.warn('⚠️ JWT refresh secret not found, using access token secret instead', {
          error: refreshError.message
        });
        this.JWT_REFRESH_SECRET = this.JWT_SECRET;
      }
      
      console.log('✅ JWT secrets loaded successfully from Secret Manager', {
        accessSecretLength: this.JWT_SECRET.length,
        hasRefreshSecret: !!this.JWT_REFRESH_SECRET,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to load JWT secrets:', {
        error: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      });
      
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'Failed to initialize JWT secrets',
        500,
        { originalError: error.message }
      );
    }
  }

  verifyToken(token, isRefreshToken = false) {
    const secretToUse = isRefreshToken ? this.JWT_REFRESH_SECRET : this.JWT_SECRET;
    const tokenType = isRefreshToken ? 'refresh' : 'access';
    
    console.log(`🔑 Verifying JWT ${tokenType} token...`, {
      hasToken: !!token,
      tokenFormat: token ? `${token.substring(0, 20)}...` : 'none',
      hasSecret: !!secretToUse,
      secretLength: secretToUse?.length,
      secretFirstChar: secretToUse ? secretToUse[0] : null,
      secretLastChar: secretToUse ? secretToUse[secretToUse.length - 1] : null,
      isRefreshToken,
      timestamp: new Date().toISOString()
    });

    if (!secretToUse) {
      console.error(`❌ JWT ${tokenType} verification failed: Secret not initialized`);
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'JWT secret not initialized or expired',
        500,
        { secretInitialized: !!secretToUse, tokenType }
      );
    }

    try {
      // First decode without verification to check structure
      const decodedHeader = jwt.decode(token, { complete: true });
      console.log('🔍 Token structure:', {
        hasHeader: !!decodedHeader?.header,
        headerComplete: JSON.stringify(decodedHeader?.header),
        algorithm: decodedHeader?.header?.alg,
        tokenType: decodedHeader?.header?.typ,
        payloadClaims: decodedHeader?.payload ? Object.keys(decodedHeader.payload) : [],
        issuer: decodedHeader?.payload?.iss,
        tokenType: decodedHeader?.payload?.type,
        timestamp: new Date().toISOString()
      });

      // Log token parts for debugging
      const [headerB64, payloadB64, signature] = token.split('.');
      console.log('🔍 Token parts:', {
        headerLength: headerB64?.length,
        payloadLength: payloadB64?.length,
        signatureLength: signature?.length,
        timestamp: new Date().toISOString()
      });
      
      // Verify with the appropriate secret based on token type
      const decoded = jwt.verify(token, secretToUse);
      
      // Additional validation for token type
      if (isRefreshToken && decoded.type !== 'refresh') {
        console.error('❌ Token type mismatch: Expected refresh token but got:', decoded.type);
        throw new AppError(
          AUTH_ERRORS.INVALID_TOKEN.code,
          'Invalid token type: Expected refresh token',
          401
        );
      }
      
      if (!isRefreshToken && decoded.type !== 'access') {
        console.error('❌ Token type mismatch: Expected access token but got:', decoded.type);
        throw new AppError(
          AUTH_ERRORS.INVALID_TOKEN.code,
          'Invalid token type: Expected access token',
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
  }
  
  /**
   * Generate a new access token using a refresh token
   * @param {string} refreshToken - The refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = this.verifyToken(refreshToken, true);
      
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
      console.error('❌ Error refreshing access token:', {
        error: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
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