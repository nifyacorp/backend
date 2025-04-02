/**
 * Test script for subscription creation
 * Tests the fixed body parsing and user synchronization for subscription creation
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Settings
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const USER_ID = process.env.USER_ID;

// Validate required environment variables
if (!AUTH_TOKEN) {
  console.error('Auth token is required. Set AUTH_TOKEN environment variable.');
  process.exit(1);
}

if (!USER_ID) {
  console.error('User ID is required. Set USER_ID environment variable.');
  process.exit(1);
}

// Headers for authenticated requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'X-User-ID': USER_ID
};

/**
 * Test user synchronization with auth endpoints
 */
async function testUserAuth() {
  console.log('🔍 Testing user authentication endpoints...');
  
  try {
    // Test user info endpoint
    console.log('Testing /api/diagnostics/user endpoint...');
    const userResponse = await fetch(`${BASE_URL}/api/diagnostics/user`, { headers });
    
    if (!userResponse.ok) {
      console.error('❌ User endpoint failed:', userResponse.status, userResponse.statusText);
      
      try {
        const errorData = await userResponse.json();
        console.error('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('Could not parse error response');
      }
      
      return false;
    }
    
    const userData = await userResponse.json();
    console.log('✅ User endpoint response:', JSON.stringify(userData, null, 2));
    
    return userData.status === 'success';
  } catch (error) {
    console.error('❌ Error testing user auth:', error.message);
    return false;
  }
}

/**
 * Test subscription creation
 */
async function testSubscriptionCreation() {
  console.log('\n🔄 Testing subscription creation...');
  
  try {
    // Create a test subscription
    const subscriptionData = {
      name: `Test Subscription ${new Date().toISOString()}`,
      type: 'boe',
      prompts: ['test keyword'],
      frequency: 'daily',
      description: 'Created by test script after fixes'
    };
    
    console.log('Creating subscription with data:', JSON.stringify(subscriptionData, null, 2));
    console.log('Using headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': `${headers.Authorization.substring(0, 15)}...`,
      'X-User-ID': headers['X-User-ID']
    });
    
    const subscriptionResponse = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(subscriptionData)
    });
    
    if (!subscriptionResponse.ok) {
      console.error('❌ Subscription creation failed:', subscriptionResponse.status, subscriptionResponse.statusText);
      
      try {
        const errorData = await subscriptionResponse.json();
        console.error('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('Could not parse error response');
      }
      
      return false;
    }
    
    const subscriptionResult = await subscriptionResponse.json();
    console.log('✅ Subscription created successfully:', JSON.stringify(subscriptionResult, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error testing subscription creation:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting subscription creation tests...');
  console.log('Base URL:', BASE_URL);
  
  // Test user auth
  const userAuthSuccess = await testUserAuth();
  
  // Test subscription creation
  const subscriptionCreationSuccess = await testSubscriptionCreation();
  
  // Print summary
  console.log('\n📊 Test Results:');
  console.log('User authentication:', userAuthSuccess ? '✅ PASS' : '❌ FAIL');
  console.log('Subscription creation:', subscriptionCreationSuccess ? '✅ PASS' : '❌ FAIL');
  
  // Exit with appropriate code
  if (userAuthSuccess && subscriptionCreationSuccess) {
    console.log('\n🎉 All tests passed successfully!');
    process.exit(0);
  } else {
    console.error('\n❌ Some tests failed. See details above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Unhandled error in test script:', error);
  process.exit(1);
});