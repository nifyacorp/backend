import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import jwt from 'jsonwebtoken';

let JWT_SECRET;

const secretClient = new SecretManagerServiceClient();

export async function initializeAuth() {
  try {
    console.log('🔐 Initializing auth configuration...');
    
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/delta-entity-447812-p2/secrets/JWT_SECRET/versions/latest'
    });

    JWT_SECRET = version.payload.data.toString();
    console.log('✅ JWT secret loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load JWT secret:', error);
    throw error;
  }
}

export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not initialized');
  }
  return jwt.verify(token, JWT_SECRET);
}