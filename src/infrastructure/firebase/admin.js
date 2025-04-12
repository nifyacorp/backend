/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin SDK for server-side authentication
 */

import admin from 'firebase-admin';
import * as logger from '../../shared/logger.js';
import { getSecret, initialize as initializeSecrets } from '../secrets/manager.js';

// Singleton instance
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * 
 * Uses GCP service credentials when deployed to Cloud Run,
 * no explicit credentials needed as it uses Application Default Credentials
 */
export async function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    try {
      // Initialize secrets manager first
      await initializeSecrets();
      
      // Get all required Firebase secrets from Secret Manager
      const projectId = await getSecret('FIREBASE_PROJECT_ID');
      const storageBucket = await getSecret('FIREBASE_STORAGE_BUCKET');
      
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID secret is not available');
      }
      
      logger.logAuth({}, 'Initializing auth service with Firebase', { 
        service: 'backend-service',
        environment: process.env.NODE_ENV || 'development',
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'unknown',
        firebaseProject: projectId, 
        type: 'auth'
      });
      
      // Initialize Firebase Admin SDK with all required configuration
      firebaseApp = admin.initializeApp({
        projectId,
        storageBucket: storageBucket || `${projectId}.appspot.com`,
        // In Cloud Run, credential is automatically obtained from the environment
        credential: admin.credential.applicationDefault()
      });
      
      logger.logAuth({}, 'Firebase Admin SDK initialized successfully', { 
        projectId,
        storageBucket: storageBucket || `${projectId}.appspot.com`
      });

      // Log the available Firebase services for debugging
      const availableServices = [];
      if (firebaseApp.auth) availableServices.push('auth');
      if (firebaseApp.firestore) availableServices.push('firestore');
      if (firebaseApp.storage) availableServices.push('storage');
      
      logger.logAuth({}, 'Firebase services available', { services: availableServices });

    } catch (error) {
      logger.logError({}, error, { 
        context: 'Failed to initialize Firebase Admin SDK',
        projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'unknown'
      });
      
      throw error;
    }
  }
  
  return firebaseApp;
}

/**
 * Get Firebase Auth service
 */
export function getFirebaseAuth() {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebaseAdmin() first.');
  }
  return firebaseApp.auth();
}

/**
 * Verify Firebase ID token
 * 
 * @param {string} idToken - Firebase ID token to verify
 * @returns {Promise<Object>} Decoded token with user info
 */
export async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAuth();
  return await auth.verifyIdToken(idToken);
}

/**
 * Get Firebase user by ID
 * 
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Object>} Firebase user record
 */
export async function getFirebaseUser(uid) {
  const auth = getFirebaseAuth();
  return await auth.getUser(uid);
}

/**
 * Get Firebase user by email
 * 
 * @param {string} email - User email
 * @returns {Promise<Object>} Firebase user record
 */
export async function getFirebaseUserByEmail(email) {
  const auth = getFirebaseAuth();
  return await auth.getUserByEmail(email);
} 