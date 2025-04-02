/**
 * Test script to verify database fixes
 */

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_URL = process.env.AUTH_URL || 'https://authentication-service-415554190254.us-central1.run.app';
const EMAIL = process.env.TEST_EMAIL || 'ratonxi@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || 'PasswordTest1!';

// Tests to run
const TESTS = {
  AUTH: true,
  SUBSCRIPTIONS_LIST: true,
  SUBSCRIPTION_CREATE: true,
  NOTIFICATIONS: true,
  TEMPLATES: true
};

async function login() {
  console.log('🔑 Authenticating user...');
  
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD
      })
    });
    
    if (!response.ok) {
      throw new Error(`Authentication failed with status: ${response.status}`);
    }
    
    const authData = await response.json();
    
    if (!authData.accessToken) {
      throw new Error('No access token received');
    }
    
    console.log('✅ Authentication successful');
    return authData.accessToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }
}

async function getProfile(token) {
  console.log('👤 Fetching user profile...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile with status: ${response.status}`);
    }
    
    const profile = await response.json();
    console.log('✅ Profile retrieved:', profile.id);
    return profile;
  } catch (error) {
    console.error('❌ Profile fetch failed:', error.message);
    return null;
  }
}

async function listSubscriptions(token) {
  console.log('📋 Listing subscriptions...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
      method: 'GET',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list subscriptions with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Subscriptions retrieved: ${data.subscriptions?.length || 0} items`);
    return data;
  } catch (error) {
    console.error('❌ Subscription listing failed:', error.message);
    return null;
  }
}

async function createSubscription(token, userId) {
  console.log('📝 Creating test subscription...');
  
  const subscriptionData = {
    name: 'Test Subscription',
    description: 'Test subscription created after database fixes',
    type: 'BOE',
    userId: userId,
    prompts: ['test keyword', 'another keyword'],
    frequency: 'daily'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });
    
    const responseText = await response.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Could not parse response as JSON:', responseText);
      return null;
    }
    
    if (!response.ok) {
      console.error('❌ Subscription creation failed:', result);
      throw new Error(`Failed to create subscription with status: ${response.status}`);
    }
    
    console.log('✅ Subscription created successfully:', result.id);
    
    return result;
  } catch (error) {
    console.error('❌ Subscription creation failed:', error.message);
    return null;
  }
}

async function getNotifications(token) {
  console.log('🔔 Fetching notifications...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notifications with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Notifications retrieved: ${data.notifications?.length || 0} items`);
    return data;
  } catch (error) {
    console.error('❌ Notifications fetch failed:', error.message);
    return null;
  }
}

async function getTemplates(token) {
  console.log('📋 Fetching templates...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/templates`, {
      method: 'GET',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch templates with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Templates retrieved: ${data.templates?.length || 0} items`);
    return data;
  } catch (error) {
    console.error('❌ Templates fetch failed:', error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('🚀 Starting post-fix tests');
    
    // Login to get access token
    const token = await login();
    
    // Create results object
    const results = {
      auth: { success: true, message: 'Login successful' },
      profile: null,
      subscriptionsList: null,
      subscriptionCreate: null,
      notifications: null,
      templates: null
    };
    
    // Get user profile to get user ID
    if (TESTS.AUTH) {
      const profile = await getProfile(token);
      results.profile = profile;
      
      if (!profile || !profile.id) {
        throw new Error('Failed to get valid user profile');
      }
    }
    
    // List subscriptions
    if (TESTS.SUBSCRIPTIONS_LIST) {
      const subscriptionsList = await listSubscriptions(token);
      results.subscriptionsList = subscriptionsList;
    }
    
    // Create a subscription
    if (TESTS.SUBSCRIPTION_CREATE && results.profile) {
      const subscription = await createSubscription(token, results.profile.id);
      results.subscriptionCreate = subscription;
    }
    
    // Get notifications
    if (TESTS.NOTIFICATIONS) {
      const notifications = await getNotifications(token);
      results.notifications = notifications;
    }
    
    // Get templates
    if (TESTS.TEMPLATES) {
      const templates = await getTemplates(token);
      results.templates = templates;
    }
    
    // Save results to a file
    writeFileSync('post-fix-test-results.json', JSON.stringify(results, null, 2));
    
    // Print summary
    console.log('\n----- TEST RESULTS SUMMARY -----');
    console.log(`Authentication: ${results.auth.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Profile: ${results.profile ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Subscriptions List: ${results.subscriptionsList ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Subscription Creation: ${results.subscriptionCreate ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Notifications: ${results.notifications ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Templates: ${results.templates ? '✅ PASS' : '❌ FAIL'}`);
    console.log('--------------------------------');
    
    // Check overall status
    const allPassed = results.auth.success && 
                     results.profile && 
                     results.subscriptionsList && 
                     results.subscriptionCreate && 
                     results.notifications && 
                     results.templates;
    
    console.log(`\nOverall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!allPassed) {
      console.log('\nSee post-fix-test-results.json for details');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
main();