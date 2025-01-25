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
  console.log('🔑 Verifying JWT token...', {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenStart: token?.substring(0, 20) + '...',
    secretLoaded: SECRET_LOADED,
    timestamp: new Date().toISOString()
  });

  if (!SECRET_LOADED || !JWT_SECRET) {
    console.error('❌ JWT verification failed: Secret not initialized', {
      secretLoaded: SECRET_LOADED,
      hasSecret: !!JWT_SECRET,
      timestamp: new Date().toISOString()
    });
    throw new Error('JWT secret not initialized');
  }

  try {
    // Ensure JWT_SECRET is loaded
    if (!JWT_SECRET) {
      await initializeAuth();
    }

    // First decode without verification to log token structure
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      console.error('❌ Failed to decode token:', {
        token: token?.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });
      throw new Error('Invalid token format');
    }
    
    console.log('🔍 Token structure:', {
      header: decoded?.header,
      algorithm: decoded?.header?.alg,
      claims: {
        ...decoded?.payload,
        sub: decoded?.payload?.sub ? '[REDACTED]' : undefined,
        type: decoded?.payload?.type,
        iat: decoded?.payload?.iat,
        exp: decoded?.payload?.exp
      },
      timestamp: new Date().toISOString()
    });

    // Now verify the token
    const verified = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully', {
      hasSub: !!verified.sub,
      type: verified.type,
      timestamp: new Date().toISOString()
    });

    return verified;
  } catch (error) {
    console.error('❌ JWT verification failed:', {
      error: error.message,
      name: error.name,
      code: error.code,
      expiredAt: error.expiredAt,
      stack: error.stack?.split('\n')[0],
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}