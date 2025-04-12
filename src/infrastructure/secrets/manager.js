/**
 * Secrets Manager for Backend Service
 * 
 * Provides unified access to secrets stored in Google Cloud Secret Manager
 * Falls back to environment variables in development mode
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as logger from '../../shared/logger.js';

// Singleton pattern to avoid multiple initializations
let client;
let initialized = false;

// Cache for secrets to avoid repeated calls to Secret Manager
const secretsCache = new Map();

class SecretsManager {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    this.envSecrets = {};
  }

  async initialize() {
    if (initialized) return;
    
    if (this.isDevelopment) {
      logger.logRequest({}, 'Running in development mode, using environment variables instead of Secret Manager');
      
      // Pre-load environment variables as secrets in development
      this.envSecrets = {
        'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID,
        'FIREBASE_API_KEY': process.env.FIREBASE_API_KEY,
        'FIREBASE_AUTH_DOMAIN': process.env.FIREBASE_AUTH_DOMAIN,
        'FIREBASE_STORAGE_BUCKET': process.env.FIREBASE_STORAGE_BUCKET,
        'FIREBASE_APP_ID': process.env.FIREBASE_APP_ID,
        'FIREBASE_MEASUREMENT_ID': process.env.FIREBASE_MEASUREMENT_ID,
        'JWT_SECRET': process.env.JWT_SECRET,
        'JWT_REFRESH_SECRET': process.env.JWT_REFRESH_SECRET,
        'DB_NAME': process.env.DB_NAME || 'nifya_db',
        'DB_USER': process.env.DB_USER || 'postgres',
        'DB_PASSWORD': process.env.DB_PASSWORD || 'postgres',
      };
      
      initialized = true;
      
      // Validate and log required secrets in development mode
      this.validateRequiredSecrets();
      return;
    }

    // Initialize Secret Manager client for production
    if (!client) {
      try {
        client = new SecretManagerServiceClient();
        initialized = true;
        
        // Log secrets validation in production mode 
        // (actual secrets will be loaded on-demand by getSecret)
        logger.logRequest({}, 'Secret Manager client initialized successfully');
        
        // Validate project ID - crucial for operation
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
        if (!projectId) {
          throw new Error('GOOGLE_CLOUD_PROJECT or PROJECT_ID environment variable is required');
        }
        
        console.log('✅ Environment variables validated:', { 
          checkedVars: 3, 
          timestamp: new Date().toISOString() 
        });
      } catch (error) {
        logger.logError({}, error, { 
          context: 'Failed to initialize Secret Manager client'
        });
        throw error;
      }
    }
  }

  validateRequiredSecrets() {
    const requiredFirebaseSecrets = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_STORAGE_BUCKET'
    ];
    
    const missingSecrets = requiredFirebaseSecrets.filter(secret => !this.envSecrets[secret]);
    
    if (missingSecrets.length > 0) {
      logger.logError({}, new Error(`Missing required Firebase secrets: ${missingSecrets.join(', ')}`));
    } else {
      console.log('✅ Environment variables validated:', { 
        checkedVars: requiredFirebaseSecrets.length, 
        timestamp: new Date().toISOString() 
      });
    }
  }

  async getSecret(secretName) {
    // Check if we already have this secret in cache
    if (secretsCache.has(secretName)) {
      return secretsCache.get(secretName);
    }
    
    // Use environment variables in development mode
    if (this.isDevelopment) {
      const secretValue = this.envSecrets[secretName];
      logger.logger.debug('Using development secret', { secretName, valueExists: !!secretValue });
      
      // Cache the result
      if (secretValue) {
        secretsCache.set(secretName, secretValue);
      }
      
      return secretValue;
    }

    // Make sure client is initialized
    if (!client) {
      await this.initialize();
    }

    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
      
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT or PROJECT_ID environment variable is not set');
      }
      
      logger.logger.debug('Attempting to retrieve secret', { 
        secretName,
        projectId,
        secretPath: `projects/${projectId}/secrets/${secretName}/versions/latest`
      });

      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
      });

      if (!version || !version.payload || !version.payload.data) {
        throw new Error(`Could not retrieve secret: ${secretName}`);
      }

      const secretValue = version.payload.data.toString();
      logger.logger.debug('Secret retrieved successfully', { secretName });
      
      // Cache the result
      secretsCache.set(secretName, secretValue);
      
      return secretValue;
    } catch (error) {
      logger.logError({}, error, { 
        context: 'Failed to retrieve secret',
        secretName,
        projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID
      });
      
      // Cache the failure (returning null) to avoid repeated failures
      secretsCache.set(secretName, null);
      
      return null;
    }
  }
}

// Create singleton instance
const secretsManager = new SecretsManager();

// Export the functions for use in the application
export const getSecret = (secretName) => secretsManager.getSecret(secretName);
export const initialize = () => secretsManager.initialize(); 