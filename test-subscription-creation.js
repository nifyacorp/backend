/**
 * Test script to verify subscription creation after database fixes
 */

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_URL = process.env.AUTH_URL || 'https://authentication-service-415554190254.us-central1.run.app';
const EMAIL = process.env.TEST_EMAIL || 'ratonxi@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || 'PasswordTest1!';

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

async function createSubscription(token, userId) {
  console.log('📝 Creating test subscription...');
  
  const subscriptionData = {
    name: 'Test Subscription',
    description: 'Subscription created by test script',
    userId: userId,
    type: 'BOE',
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
    
    // Save the subscription details to a file for reference
    writeFileSync('subscription-test-result.json', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ Subscription creation failed:', error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('🚀 Starting subscription creation test');
    
    // Login to get access token
    const token = await login();
    
    // Get user profile to get user ID
    const profile = await getProfile(token);
    
    if (!profile || !profile.id) {
      throw new Error('Failed to get valid user profile');
    }
    
    // Create a test subscription
    const subscription = await createSubscription(token, profile.id);
    
    if (subscription && subscription.id) {
      console.log('✅ TEST PASSED: Subscription was created successfully');
      console.log('Subscription ID:', subscription.id);
    } else {
      console.log('❌ TEST FAILED: Could not create subscription');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
main();