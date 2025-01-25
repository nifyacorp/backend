import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { AppError } from '../../shared/errors/AppError.js';
import { AUTH_ERRORS } from '../types/auth.types.js';

class AuthService {
  constructor() {
    this.secretClient = new SecretManagerServiceClient();
    this.JWT_SECRET = null;
    this.SECRET_EXPIRY = null;
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  }

  async initialize() {
    if (this.JWT_SECRET && this.SECRET_EXPIRY && Date.now() < this.SECRET_EXPIRY) {
      return;
    }

    try {
      const [version] = await this.secretClient.accessSecretVersion({
        name: 'projects/delta-entity-447812-p2/secrets/JWT_SECRET/versions/latest'
      });
      
      this.JWT_SECRET = version.payload.data.toString();
      this.SECRET_EXPIRY = Date.now() + this.CACHE_DURATION;
    } catch (error) {
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'Failed to initialize JWT secret',
        500,
        { originalError: error.message }
      );
    }
  }

  verifyToken(token) {
    if (!this.JWT_SECRET || !this.SECRET_EXPIRY || Date.now() >= this.SECRET_EXPIRY) {
      throw new AppError(
        AUTH_ERRORS.SECRET_ERROR.code,
        'JWT secret not initialized or expired',
        500,
        { secretInitialized: !!this.JWT_SECRET, secretExpired: Date.now() >= this.SECRET_EXPIRY }
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