/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin SDK for server-side authentication
 */

import admin from 'firebase-admin';
import logger from '../../shared/logger.js';
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
      
      // Get Firebase project ID from Secret Manager
      const projectId = await getSecret('FIREBASE_PROJECT_ID');
      
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID secret is not available');
      }
      
      // Initialize Firebase Admin SDK
      firebaseApp = admin.initializeApp({
        projectId
      });
      
      logger.logAuth({}, 'Firebase Admin SDK initialized successfully', { projectId });
    } catch (error) {
      logger.logError({}, 'Failed to initialize Firebase Admin SDK', { 
        error: error.message,
        stack: error.stack 
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