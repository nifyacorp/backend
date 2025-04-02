// Post-Fix Test Script
// This script tests the fixes implemented for the foreign key constraint and missing column issues

const fetch = require('node-fetch');
const fs = require('fs');
const { exit } = require('process');

// Configuration
const BASE_URL = process.env.SERVICE_URL || 'http://localhost:3000';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://authentication-service-415554190254.us-central1.run.app';
let USER_ID;
let AUTH_TOKEN;

async function login() {
  console.log('🔑 Getting authentication token...');
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/test/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
      }),
    });

    if (!response.ok) {
      throw new Error(`Auth service returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    USER_ID = data.userId;
    AUTH_TOKEN = data.token;

    console.log(`✅ Authentication successful. User ID: ${USER_ID}`);
    return { userId: USER_ID, token: AUTH_TOKEN };
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    throw error;
  }
}

async function testCreateUser(userId, token) {
  console.log('\n🧪 Testing user creation diagnostic endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/diagnostics/create-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com'
      })
    });

    if (!response.ok) {
      throw new Error(`Create user endpoint returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ User diagnostic endpoint response: ${data.created ? 'Created new user' : 'User already exists'}`);
    return data;
  } catch (error) {
    console.error('❌ User creation test failed:', error);
    return { status: 'error', error: error.message };
  }
}

async function testSubscriptionCreation(userId, token) {
  console.log('\n🧪 Testing subscription creation...');
  try {
    const subscription = {
      name: 'Test Subscription',
      description: 'Created by post-fix test',
      type: 'BOE',
      frequency: 'daily',
      prompts: ['Test prompt'],
      logo: 'https://example.com/test.png'
    };

    const response = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error(`Subscription creation returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ Subscription created successfully! ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Subscription creation test failed:', error);
    return { status: 'error', error: error.message };
  }
}

async function testSubscriptionProcessing(userId, token, subscriptionId) {
  console.log('\n🧪 Testing subscription processing...');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions/${subscriptionId}/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Subscription processing returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ Subscription processing initiated! Processing ID: ${data.processingId}`);
    return data;
  } catch (error) {
    console.error('❌ Subscription processing test failed:', error);
    return { status: 'error', error: error.message };
  }
}

async function testGetSubscriptions(userId, token) {
  console.log('\n🧪 Testing get subscriptions...');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId
      }
    });

    if (!response.ok) {
      throw new Error(`Get subscriptions returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.subscriptions.length} subscriptions`);
    return data;
  } catch (error) {
    console.error('❌ Get subscriptions test failed:', error);
    return { status: 'error', error: error.message };
  }
}

async function testGetNotifications(userId, token) {
  console.log('\n🧪 Testing notifications endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId
      }
    });

    if (!response.ok) {
      throw new Error(`Get notifications returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved notifications. Total: ${data.total}, Unread: ${data.unread}`);
    return data;
  } catch (error) {
    console.error('❌ Get notifications test failed:', error);
    return { status: 'error', error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting post-fix tests...');
  console.log(`📡 Backend URL: ${BASE_URL}`);
  console.log(`📡 Auth Service URL: ${AUTH_SERVICE_URL}`);

  try {
    // Step 1: Login and get token
    const auth = await login();

    // Step 2: Create user if needed
    const userResult = await testCreateUser(auth.userId, auth.token);

    // Step 3: Test subscription creation
    const subscriptionResult = await testSubscriptionCreation(auth.userId, auth.token);
    
    // Step 4: Test subscription processing if creation succeeded
    let processingResult = { status: 'skipped' };
    if (subscriptionResult.id) {
      processingResult = await testSubscriptionProcessing(auth.userId, auth.token, subscriptionResult.id);
    }

    // Step 5: Test getting all subscriptions
    const subscriptionsResult = await testGetSubscriptions(auth.userId, auth.token);

    // Step 6: Test getting notifications
    const notificationsResult = await testGetNotifications(auth.userId, auth.token);

    // Compile test results
    const results = {
      timestamp: new Date().toISOString(),
      tests: {
        auth: { status: 'success', userId: auth.userId },
        user_creation: userResult,
        subscription_creation: {
          status: subscriptionResult.id ? 'success' : 'failed',
          data: subscriptionResult
        },
        subscription_processing: processingResult,
        get_subscriptions: {
          status: subscriptionsResult.subscriptions ? 'success' : 'failed',
          count: subscriptionsResult.subscriptions?.length || 0
        },
        get_notifications: {
          status: notificationsResult.total !== undefined ? 'success' : 'failed',
          total: notificationsResult.total || 0,
          unread: notificationsResult.unread || 0
        }
      }
    };

    // Save results to file
    fs.writeFileSync('post-fix-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n✅ All tests completed! Results saved to post-fix-test-results.json');

    // Final status summary
    console.log('\n📊 Test Summary:');
    console.log(`Auth: ${results.tests.auth.status === 'success' ? '✅' : '❌'}`);
    console.log(`User Creation: ${userResult.status === 'success' ? '✅' : '❌'}`);
    console.log(`Subscription Creation: ${results.tests.subscription_creation.status === 'success' ? '✅' : '❌'}`);
    console.log(`Subscription Processing: ${processingResult.processingId ? '✅' : '❌'}`);
    console.log(`Get Subscriptions: ${results.tests.get_subscriptions.status === 'success' ? '✅' : '❌'}`);
    console.log(`Get Notifications: ${results.tests.get_notifications.status === 'success' ? '✅' : '❌'}`);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run the tests
runAllTests();