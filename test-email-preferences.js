// Test script for email preferences endpoints
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_USER_ID = process.env.TEST_USER_ID || '';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

if (!TEST_USER_ID || !AUTH_TOKEN) {
  console.error('Please set TEST_USER_ID and AUTH_TOKEN environment variables');
  process.exit(1);
}

async function testEmailPreferences() {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'x-user-id': TEST_USER_ID,
    'Content-Type': 'application/json'
  };

  console.log('Testing email preferences API...');
  
  try {
    // Test GET /api/v1/me/email-preferences
    console.log('\n1. Testing GET /api/v1/me/email-preferences...');
    const getResponse = await fetch(`${BASE_URL}/api/v1/me/email-preferences`, {
      method: 'GET',
      headers
    });
    
    const getResult = await getResponse.json();
    console.log('GET response status:', getResponse.status);
    console.log('GET response body:', JSON.stringify(getResult, null, 2));
    
    if (getResponse.status !== 200) {
      console.error('GET request failed with status:', getResponse.status);
    }
    
    // Test PATCH /api/v1/me/email-preferences
    console.log('\n2. Testing PATCH /api/v1/me/email-preferences...');
    const updateData = {
      email_notifications: true,
      notification_email: TEST_EMAIL,
      digest_time: '09:00:00'
    };
    
    const patchResponse = await fetch(`${BASE_URL}/api/v1/me/email-preferences`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData)
    });
    
    const patchResult = await patchResponse.json();
    console.log('PATCH response status:', patchResponse.status);
    console.log('PATCH response body:', JSON.stringify(patchResult, null, 2));
    
    if (patchResponse.status !== 200) {
      console.error('PATCH request failed with status:', patchResponse.status);
    }
    
    // Test POST /api/v1/me/test-email
    console.log('\n3. Testing POST /api/v1/me/test-email...');
    const testEmailResponse = await fetch(`${BASE_URL}/api/v1/me/test-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: TEST_EMAIL })
    });
    
    const testEmailResult = await testEmailResponse.json();
    console.log('POST test-email response status:', testEmailResponse.status);
    console.log('POST test-email response body:', JSON.stringify(testEmailResult, null, 2));
    
    if (testEmailResponse.status !== 200) {
      console.error('POST test-email request failed with status:', testEmailResponse.status);
    }
    
    // Get updated preferences to verify changes
    console.log('\n4. Verifying changes with another GET request...');
    const verifyResponse = await fetch(`${BASE_URL}/api/v1/me/email-preferences`, {
      method: 'GET',
      headers
    });
    
    const verifyResult = await verifyResponse.json();
    console.log('Verification GET response status:', verifyResponse.status);
    console.log('Verification GET response body:', JSON.stringify(verifyResult, null, 2));
    
    // Check if values match what we set
    if (verifyResult.email_notifications !== updateData.email_notifications ||
        verifyResult.notification_email !== updateData.notification_email ||
        verifyResult.digest_time !== updateData.digest_time) {
      console.error('Verification failed - preferences do not match what was set!');
    } else {
      console.log('Verification successful - preferences match what was set!');
    }
    
    console.log('\nTests completed!');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testEmailPreferences();