import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';

class AuthService {
  constructor() {
    this.secretClient = new SecretManagerServiceClient();
    this.JWT_SECRET = null;
    this.secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/JWT_SECRET/versions/latest`;
    console.log('🔐 Initializing auth service with secret:', {
      project: process.env.GOOGLE_CLOUD_PROJECT,
      hasSecretClient: !!this.secretClient,
      timestamp: new Date().toISOString()
    });
  }

  async initialize() {
    try {
      console.log('📦 Fetching JWT secret...');
      
      const [version] = await this.secretClient.accessSecretVersion({
        name: this.secretName
      });
      
      this.JWT_SECRET = version.payload.data.toString();
      
      console.log('✅ JWT secret loaded successfully', {
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
      tokenLength: token?.length,
      hasSecret: !!this.JWT_SECRET,
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