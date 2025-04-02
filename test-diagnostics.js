/**
 * Test script for diagnostics endpoints
 * Tests the database connection and user synchronization in the backend
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
 * Test the database diagnostic endpoints
 */
async function testDatabaseDiagnostics() {
  console.log('🔍 Testing database diagnostics endpoints...');
  
  try {
    // Test basic health endpoint
    const healthResponse = await fetch(`${BASE_URL}/api/diagnostics/health`);
    const healthData = await healthResponse.json();
    
    console.log('✅ Health endpoint:', healthData.status === 'healthy' ? 'OK' : 'FAILED');
    
    // Test database connection status
    const dbStatusResponse = await fetch(`${BASE_URL}/api/diagnostics/db-status`);
    const dbStatusData = await dbStatusResponse.json();
    
    console.log('🗄️ Database status:', dbStatusData.status === 'success' ? 'OK' : 'FAILED');
    console.log('   Response time (basic query):', dbStatusData.database?.response_times?.basic_query_ms || 'N/A', 'ms');
    console.log('   Response time (complex query):', dbStatusData.database?.response_times?.complex_query_ms || 'N/A', 'ms');
    console.log('   Response time (transaction):', dbStatusData.database?.response_times?.transaction_ms || 'N/A', 'ms');
    
    if (dbStatusData.status !== 'success') {
      console.error('❌ Database status check failed:', dbStatusData.message);
    }
    
    // Test table list
    const tablesResponse = await fetch(`${BASE_URL}/api/diagnostics/db-tables`);
    const tablesData = await tablesResponse.json();
    
    if (tablesData.status === 'success') {
      console.log('📋 Database tables count:', tablesData.tables?.length || 0);
    } else {
      console.error('❌ Failed to get database tables:', tablesData.message);
    }
    
    return dbStatusData.status === 'success';
  } catch (error) {
    console.error('❌ Error testing diagnostics:', error.message);
    return false;
  }
}

/**
 * Test user synchronization by creating a subscription
 */
async function testUserSynchronization() {
  console.log('\n🔄 Testing user synchronization...');
  
  try {
    // First check if user exists
    const userResponse = await fetch(`${BASE_URL}/api/diagnostics/user-exists/${USER_ID}`);
    const userData = await userResponse.json();
    
    if (userData.exists) {
      console.log('👤 User already exists in database:', userData.user?.email || USER_ID);
    } else {
      console.log('🆕 User does not exist in database, will be created when subscription is created');
    }
    
    // Create a test subscription
    const subscriptionData = {
      name: `Test Subscription ${new Date().toISOString()}`,
      type: 'boe',
      prompts: ['test keyword'],
      frequency: 'daily',
      description: 'Created by diagnostic test script'
    };
    
    const subscriptionResponse = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(subscriptionData)
    });
    
    const subscriptionResult = await subscriptionResponse.json();
    
    if (subscriptionResponse.status === 201 && subscriptionResult.status === 'success') {
      console.log('✅ Subscription created successfully:', subscriptionResult.data?.subscription?.id);
      
      // Verify user exists after subscription creation
      const userCheckResponse = await fetch(`${BASE_URL}/api/diagnostics/user-exists/${USER_ID}`);
      const userCheckData = await userCheckResponse.json();
      
      if (userCheckData.exists) {
        console.log('✅ User exists in database after subscription creation:', userCheckData.user?.email || USER_ID);
        return true;
      } else {
        console.error('❌ User still does not exist in database after subscription creation');
        return false;
      }
    } else {
      console.error('❌ Failed to create subscription:', subscriptionResult.message || 'Unknown error');
      console.error('Response code:', subscriptionResponse.status);
      console.error('Response body:', subscriptionResult);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing user synchronization:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting diagnostic tests...');
  console.log('Base URL:', BASE_URL);
  
  // Test database diagnostics
  const dbDiagnosticsSuccess = await testDatabaseDiagnostics();
  
  // Test user synchronization
  const userSyncSuccess = await testUserSynchronization();
  
  // Print summary
  console.log('\n📊 Test Results:');
  console.log('Database diagnostics:', dbDiagnosticsSuccess ? '✅ PASS' : '❌ FAIL');
  console.log('User synchronization:', userSyncSuccess ? '✅ PASS' : '❌ FAIL');
  
  // Exit with appropriate code
  if (dbDiagnosticsSuccess && userSyncSuccess) {
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