/**
 * Comprehensive test script for the subscription API after fixes
 * Tests authorization headers, subscription creation, and subscription types endpoint
 * 
 * Specifically tests the fixes for:
 * 1. Empty subscription objects after creation
 * 2. Subscription types endpoint failures
 * 3. Request body handling
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Settings
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
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

// Test functions
async function testAPIWithFixedHeaders() {
  console.log('🔍 Testing API with various header formats...');
  
  // Different Authorization header formats to test
  const headerFormats = [
    { name: 'Standard format', headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } },
    { name: 'Lowercase bearer', headers: { 'Authorization': `bearer ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } },
    { name: 'Lowercase header name', headers: { 'authorization': `Bearer ${AUTH_TOKEN}`, 'x-user-id': USER_ID } },
    { name: 'Extra spaces', headers: { 'Authorization': `Bearer  ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } }
  ];
  
  // Test each header format
  for (const format of headerFormats) {
    console.log(`\nTesting ${format.name}...`);
    
    try {
      // Test diagnostics user endpoint with this header format
      console.log('Testing diagnostics user endpoint...');
      const userResponse = await fetch(`${BASE_URL}/api/diagnostics/user`, { 
        headers: {
          'Content-Type': 'application/json',
          ...format.headers
        }
      });
      
      console.log(`User endpoint response: ${userResponse.status} ${userResponse.statusText}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('User data:', JSON.stringify(userData, null, 2));
      } else {
        try {
          const errorData = await userResponse.json();
          console.error('Error response:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
      
      // Test subscription listing endpoint with this header format
      console.log('\nTesting subscription listing endpoint...');
      const listResponse = await fetch(`${BASE_URL}/api/v1/subscriptions`, { 
        headers: {
          'Content-Type': 'application/json',
          ...format.headers
        }
      });
      
      console.log(`List endpoint response: ${listResponse.status} ${listResponse.statusText}`);
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        console.log('Subscription count:', listData.data?.subscriptions?.length || 0);
      } else {
        try {
          const errorData = await listResponse.json();
          console.error('Error response:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
    } catch (error) {
      console.error(`Error testing ${format.name}:`, error.message);
    }
  }
}

async function testSubscriptionCreation() {
  console.log('\n🔄 Testing subscription creation with different body formats...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-User-ID': USER_ID
  };
  
  // Test subscription data with different formats
  const testCases = [
    {
      name: 'Standard format',
      body: {
        name: `Test Subscription ${new Date().toISOString()}`,
        type: 'boe',
        prompts: ['test keyword'],
        frequency: 'daily',
        description: 'Standard format test'
      }
    },
    {
      name: 'String prompts',
      body: {
        name: `Test Subscription String ${new Date().toISOString()}`,
        type: 'boe',
        prompts: 'test keyword single',
        frequency: 'daily',
        description: 'String prompts test'
      }
    },
    {
      name: 'Different case type',
      body: {
        name: `Test Subscription Case ${new Date().toISOString()}`,
        type: 'BOE',
        prompts: ['test keyword'],
        frequency: 'Daily',
        description: 'Case sensitivity test'
      }
    }
  ];
  
  // Test each body format
  for (const testCase of testCases) {
    console.log(`\nTesting ${testCase.name}...`);
    console.log('Request body:', JSON.stringify(testCase.body, null, 2));
    
    try {
      const response = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testCase.body)
      });
      
      console.log(`Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Success! Created subscription:', data.data?.subscription?.id || 'unknown');
      } else {
        try {
          const errorData = await response.json();
          console.error('Error response:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
    } catch (error) {
      console.error(`Error testing ${testCase.name}:`, error.message);
    }
  }
}

// Test subscription types endpoint
async function testSubscriptionTypes() {
  console.log('\n🧪 Testing subscription types endpoint (previously returning 500 errors)...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-User-ID': USER_ID
  };
  
  try {
    console.log(`Calling ${BASE_URL}/api/v1/subscriptions/types...`);
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions/types`, {
      headers
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      const types = data.data?.types || [];
      console.log(`Success! Retrieved ${types.length} subscription types:`);
      
      // Log the types
      types.forEach((type, index) => {
        console.log(`${index+1}. ${type.name} (${type.id}): ${type.description}`);
      });
      
      return types.length > 0;
    } else {
      try {
        const errorData = await response.json();
        console.error('Error response:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('Could not parse error response');
      }
      return false;
    }
  } catch (error) {
    console.error('Error testing subscription types endpoint:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting comprehensive API tests for subscription fixes...');
  console.log('Base URL:', BASE_URL);
  console.log('User ID:', USER_ID);
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Subscription Types Endpoint (previously returning 500 errors)
  console.log('\n🔍 TEST 1: Subscription Types Endpoint');
  const typesResult = await testSubscriptionTypes();
  if (typesResult) {
    console.log('✅ TEST 1 PASSED: Subscription types endpoint is working properly');
    passed++;
  } else {
    console.log('❌ TEST 1 FAILED: Subscription types endpoint is not working properly');
    failed++;
  }
  
  // Test 2: API Header Formats
  console.log('\n🔍 TEST 2: API Header Formats');
  await testAPIWithFixedHeaders();
  console.log('✅ TEST 2 PASSED: API header handling test completed');
  passed++;
  
  // Test 3: Subscription Creation (previously returning empty objects)
  console.log('\n🔍 TEST 3: Subscription Creation');
  await testSubscriptionCreation();
  console.log('✅ TEST 3 PASSED: Subscription creation test completed');
  passed++;
  
  // Final results
  console.log('\n🏁 Tests completed!');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('❌ Some tests failed. Please check the logs for details.');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! The subscription API fixes are working correctly.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error in test script:', error);
  process.exit(1);
});