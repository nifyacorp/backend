/*
 * User Synchronization Test
 * 
 * This script tests the user synchronization functionality in auth middleware
 * to ensure it correctly creates a user with the latest database schema.
 */

import { synchronizeUser } from './src/interfaces/http/middleware/auth.middleware.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_NAME = 'Test User';

async function testUserSync() {
  console.log('Testing user synchronization...');
  
  try {
    // Attempt to synchronize a test user
    await synchronizeUser(
      TEST_USER_ID,
      {
        email: TEST_USER_EMAIL,
        name: TEST_USER_NAME
      },
      {
        requestId: 'test-req',
        path: '/test'
      }
    );
    
    console.log('User synchronization successful!');
  } catch (error) {
    console.error('User synchronization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testUserSync().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});