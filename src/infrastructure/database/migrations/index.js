/**
 * Migrations index
 * Exports all migrations in a single file for easy importing
 */

import { migrate as addFirebaseUid } from './add-firebase-uid.js';

// Export all migrations
export const migrations = [
  addFirebaseUid
];

/**
 * Run all migrations in sequence
 */
export async function runMigrations() {
  console.log('Running database migrations...');
  
  for (const migration of migrations) {
    try {
      await migration();
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
  
  console.log('Database migrations completed successfully');
} 