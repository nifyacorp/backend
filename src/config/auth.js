import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import jwt from 'jsonwebtoken';

let JWT_SECRET;
let SECRET_LOADED = false;

const secretClient = new SecretManagerServiceClient();

export async function initializeAuth() {
  try {
    console.log('🔐 Initializing auth configuration...');

    console.log('📦 Fetching JWT secret from Secret Manager...');
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/delta-entity-447812-p2/secrets/JWT_SECRET/versions/latest'
    });

    JWT_SECRET = version.payload.data.toString();
    SECRET_LOADED = true;
    console.log('✅ JWT secret loaded successfully', {
      secretLength: JWT_SECRET.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to load JWT secret:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function verifyToken(token) {
  if (!SECRET_LOADED || !JWT_SECRET) {
    throw { code: 'CONFIG_ERROR', message: 'JWT secret not initialized' };
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw { code: 'TOKEN_EXPIRED', message: 'Token has expired' };
    }
    throw { code: 'INVALID_TOKEN', message: 'Invalid token' };
  }
}