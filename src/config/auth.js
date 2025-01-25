import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import jwt from 'jsonwebtoken';

// Secret cache with expiration
let JWT_SECRET;
let SECRET_EXPIRY;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const secretClient = new SecretManagerServiceClient();

export async function initializeAuth() {
  // Return if secret is still valid
  if (JWT_SECRET && SECRET_EXPIRY && Date.now() < SECRET_EXPIRY) {
    return;
  }

  try {
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/delta-entity-447812-p2/secrets/JWT_SECRET/versions/latest'
    });
    
    JWT_SECRET = version.payload.data.toString();
    SECRET_EXPIRY = Date.now() + CACHE_DURATION;
    
  } catch (error) {
    console.error('Failed to load JWT secret:', error.message);
    throw new Error('JWT secret initialization failed');
  }
}

function getSecret() {
  if (!JWT_SECRET || !SECRET_EXPIRY || Date.now() >= SECRET_EXPIRY) {
    throw new Error('JWT secret not initialized or expired');
  }
  return JWT_SECRET;
}

export function verifyToken(token) {
  try {
    const secret = getSecret();
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw { code: 'TOKEN_EXPIRED', message: 'Token has expired' };
    }
    if (error.message === 'JWT secret not initialized or expired') {
      throw { code: 'SECRET_ERROR', message: 'Authentication service unavailable' };
    }
    throw { code: 'INVALID_TOKEN', message: 'Invalid token' };
  }
}