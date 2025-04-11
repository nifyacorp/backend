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

class SecretsManager {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    this.envSecrets = {};
  }

  async initialize() {
    if (initialized) return;
    
    if (this.isDevelopment) {
      logger.logInfo({}, 'Running in development mode, using environment variables instead of Secret Manager');
      
      // Pre-load environment variables as secrets in development
      this.envSecrets = {
        'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID,
        'FIREBASE_API_KEY': process.env.FIREBASE_API_KEY,
        'FIREBASE_AUTH_DOMAIN': process.env.FIREBASE_AUTH_DOMAIN,
        'JWT_SECRET': process.env.JWT_SECRET,
        'JWT_REFRESH_SECRET': process.env.JWT_REFRESH_SECRET,
        'DB_NAME': process.env.DB_NAME || 'nifya_db',
        'DB_USER': process.env.DB_USER || 'postgres',
        'DB_PASSWORD': process.env.DB_PASSWORD || 'postgres',
      };
      
      initialized = true;
      return;
    }

    // Initialize Secret Manager client for production
    if (!client) {
      try {
        client = new SecretManagerServiceClient();
        initialized = true;
        logger.logInfo({}, 'Secret Manager client initialized successfully');
      } catch (error) {
        logger.logError({}, 'Failed to initialize Secret Manager client', { 
          error: error.message,
          stack: error.stack 
        });
        throw error;
      }
    }
  }

  async getSecret(secretName) {
    // Use environment variables in development mode
    if (this.isDevelopment) {
      const secretValue = this.envSecrets[secretName];
      logger.logDebug({}, 'Using development secret', { secretName, valueExists: !!secretValue });
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
      
      logger.logDebug({}, 'Attempting to retrieve secret', { 
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
      logger.logDebug({}, 'Secret retrieved successfully', { secretName });
      
      return secretValue;
    } catch (error) {
      logger.logError({}, 'Failed to retrieve secret', { 
        error: error.message,
        errorStack: error.stack,
        secretName,
        projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID
      });
      throw error;
    }
  }
}

// Create singleton instance
const secretsManager = new SecretsManager();

// Export the functions for use in the application
export const getSecret = (secretName) => secretsManager.getSecret(secretName);
export const initialize = () => secretsManager.initialize(); 