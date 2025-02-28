import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';

class AuthService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.secretClient = this.isProduction ? new SecretManagerServiceClient() : null;
    this.JWT_SECRET = null;
    this.secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/JWT_SECRET/versions/latest`;
    
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
      console.log('📦 Using local JWT secret for development');
      
      if (!process.env.JWT_SECRET) {
        throw new AppError(
          AUTH_ERRORS.SECRET_ERROR.code,
          'JWT_SECRET environment variable is required in development mode',
          500
        );
      }
      
      this.JWT_SECRET = process.env.JWT_SECRET;
      
      console.log('✅ Local JWT secret loaded successfully', {
        timestamp: new Date().toISOString()
      });
      
      return;
    }
    
    try {
      console.log('📦 Fetching JWT secret from Secret Manager...');
      
      const [version] = await this.secretClient.accessSecretVersion({
        name: this.secretName
      });
      
      this.JWT_SECRET = version.payload.data.toString();
      
      console.log('✅ JWT secret loaded successfully from Secret Manager', {
        secretLength: this.JWT_SECRET.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to load JWT secret:', {
        error: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      });
      
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'Failed to initialize JWT secret',
        500,
        { originalError: error.message }
      );
    }
  }

  verifyToken(token) {
    console.log('🔑 Verifying JWT token...', {
      hasToken: !!token,
      tokenFormat: token ? `${token.substring(0, 20)}...` : 'none',
      hasSecret: !!this.JWT_SECRET,
      secretLength: this.JWT_SECRET?.length,
      secretFirstChar: this.JWT_SECRET ? this.JWT_SECRET[0] : null,
      secretLastChar: this.JWT_SECRET ? this.JWT_SECRET[this.JWT_SECRET.length - 1] : null,
      timestamp: new Date().toISOString()
    });

    if (!this.JWT_SECRET) {
      console.error('❌ JWT verification failed: Secret not initialized');
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'JWT secret not initialized or expired',
        500,
        { secretInitialized: !!this.JWT_SECRET }
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
      const decoded = jwt.verify(token, this.JWT_SECRET);
      
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
        throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        AUTH_ERRORS.INVALID_TOKEN.code,
        'Invalid token: ' + error.message,
        401,
        { originalError: error.message }
      );
    }
  }
}

export const authService = new AuthService();