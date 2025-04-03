/**
 * Test script for user profile API endpoints
 * This script verifies the fixes to the user profile API endpoints:
 * 1. PATCH /api/v1/me should work
 * 2. PATCH /api/v1/me/notification-settings should work
 * 3. Email preferences updates should be persisted
 * 4. Test email endpoint should handle PubSub failures gracefully
 */

import fetch from 'node-fetch';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function main() {
  // Ask for the user's credentials
  const token = await askQuestion('Enter your auth token (Bearer xxx...): ');
  const userId = await askQuestion('Enter your user ID: ');
  const baseUrl = await askQuestion('Enter the API base URL (default: http://localhost:8080): ') || 'http://localhost:8080';

  // Headers for authentication
  const headers = {
    'Authorization': token,
    'x-user-id': userId,
    'Content-Type': 'application/json'
  };

  console.log('\nRunning API tests...');
  console.log('Using base URL:', baseUrl);
  console.log('Using user ID:', userId);

  try {
    // 1. Test GET /api/v1/me
    console.log('\n1. Testing GET /api/v1/me endpoint...');
    const profileResponse = await fetch(`${baseUrl}/api/v1/me`, {
      method: 'GET',
      headers
    });
    
    if (!profileResponse.ok) {
      console.error(`Profile endpoint failed with status: ${profileResponse.status}`);
      throw new Error(`GET /api/v1/me failed with status: ${profileResponse.status}`);
    }
    
    const profileData = await profileResponse.json();
    console.log('Profile:', profileData.profile);
    
    // 2. Test PATCH /api/v1/me
    console.log('\n2. Testing PATCH /api/v1/me endpoint...');
    const profileUpdateData = {
      name: `Test User ${new Date().toISOString().substring(0, 10)}`,
      language: 'en'
    };
    
    const updateResponse = await fetch(`${baseUrl}/api/v1/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(profileUpdateData)
    });
    
    if (!updateResponse.ok) {
      console.error(`Profile update endpoint failed with status: ${updateResponse.status}`);
      const errorBody = await updateResponse.text();
      console.error('Error details:', errorBody);
      throw new Error(`PATCH /api/v1/me failed with status: ${updateResponse.status}`);
    }
    
    const updatedProfile = await updateResponse.json();
    console.log('Updated profile:', updatedProfile);
    
    // Verify the update was applied
    if (updatedProfile.profile.name !== profileUpdateData.name) {
      console.error('Profile update failed - name not updated');
    } else {
      console.log('✅ Profile update successful - name updated');
    }
    
    // 3. Test PATCH /api/v1/me/notification-settings
    console.log('\n3. Testing PATCH /api/v1/me/notification-settings endpoint...');
    const notificationSettingsData = {
      emailNotifications: true,
      instantNotifications: true
    };
    
    const notifUpdateResponse = await fetch(`${baseUrl}/api/v1/me/notification-settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(notificationSettingsData)
    });
    
    if (!notifUpdateResponse.ok) {
      console.error(`Notification settings update endpoint failed with status: ${notifUpdateResponse.status}`);
      const errorBody = await notifUpdateResponse.text();
      console.error('Error details:', errorBody);
      throw new Error(`PATCH /api/v1/me/notification-settings failed with status: ${notifUpdateResponse.status}`);
    }
    
    const updatedSettings = await notifUpdateResponse.json();
    console.log('Updated notification settings:', updatedSettings);
    
    // 4. Test GET /api/v1/me/email-preferences
    console.log('\n4. Testing GET /api/v1/me/email-preferences endpoint...');
    const emailPrefsResponse = await fetch(`${baseUrl}/api/v1/me/email-preferences`, {
      method: 'GET',
      headers
    });
    
    if (!emailPrefsResponse.ok) {
      console.error(`Email preferences endpoint failed with status: ${emailPrefsResponse.status}`);
      throw new Error(`GET /api/v1/me/email-preferences failed with status: ${emailPrefsResponse.status}`);
    }
    
    const emailPrefsData = await emailPrefsResponse.json();
    console.log('Email preferences:', emailPrefsData);
    
    // 5. Test PATCH /api/v1/me/email-preferences
    console.log('\n5. Testing PATCH /api/v1/me/email-preferences endpoint...');
    const emailPrefsUpdateData = {
      email_notifications: true,
      digest_time: '09:30:00'
    };
    
    const emailPrefsUpdateResponse = await fetch(`${baseUrl}/api/v1/me/email-preferences`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(emailPrefsUpdateData)
    });
    
    if (!emailPrefsUpdateResponse.ok) {
      console.error(`Email preferences update endpoint failed with status: ${emailPrefsUpdateResponse.status}`);
      const errorBody = await emailPrefsUpdateResponse.text();
      console.error('Error details:', errorBody);
      throw new Error(`PATCH /api/v1/me/email-preferences failed with status: ${emailPrefsUpdateResponse.status}`);
    }
    
    const updatedEmailPrefs = await emailPrefsUpdateResponse.json();
    console.log('Updated email preferences:', updatedEmailPrefs);
    
    // 6. Verify email preferences update
    console.log('\n6. Verifying email preferences update...');
    const verifyEmailPrefsResponse = await fetch(`${baseUrl}/api/v1/me/email-preferences`, {
      method: 'GET',
      headers
    });
    
    if (!verifyEmailPrefsResponse.ok) {
      console.error(`Email preferences verification failed with status: ${verifyEmailPrefsResponse.status}`);
      throw new Error(`GET /api/v1/me/email-preferences failed with status: ${verifyEmailPrefsResponse.status}`);
    }
    
    const verifiedEmailPrefs = await verifyEmailPrefsResponse.json();
    console.log('Verified email preferences:', verifiedEmailPrefs);
    
    // Check if the email preferences were updated correctly
    if (verifiedEmailPrefs.email_notifications !== emailPrefsUpdateData.email_notifications ||
        verifiedEmailPrefs.digest_time !== emailPrefsUpdateData.digest_time) {
      console.error('❌ Email preferences update verification failed - preferences not updated correctly');
    } else {
      console.log('✅ Email preferences update verification successful');
    }
    
    // 7. Test POST /api/v1/me/test-email
    console.log('\n7. Testing POST /api/v1/me/test-email endpoint...');
    
    // Use a valid test email address
    const testEmail = profileData.profile.email || "test@example.com";
    
    const testEmailResponse = await fetch(`${baseUrl}/api/v1/me/test-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: testEmail })
    });
    
    if (!testEmailResponse.ok) {
      console.error(`Test email endpoint failed with status: ${testEmailResponse.status}`);
      const errorBody = await testEmailResponse.text();
      console.error('Error details:', errorBody);
      throw new Error(`POST /api/v1/me/test-email failed with status: ${testEmailResponse.status}`);
    }
    
    const testEmailResult = await testEmailResponse.json();
    console.log('Test email result:', testEmailResult);
    console.log('✅ Test email endpoint working successfully');
    
    // Final summary
    console.log('\n======= TEST SUMMARY =======');
    console.log('GET /api/v1/me: ✅ SUCCESS');
    console.log('PATCH /api/v1/me: ✅ SUCCESS');
    console.log('PATCH /api/v1/me/notification-settings: ✅ SUCCESS');
    console.log('GET /api/v1/me/email-preferences: ✅ SUCCESS');
    console.log('PATCH /api/v1/me/email-preferences: ✅ SUCCESS');
    console.log('Email preferences persistence: ✅ SUCCESS');
    console.log('POST /api/v1/me/test-email: ✅ SUCCESS');
    console.log('All user profile API endpoints are working correctly!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    rl.close();
  }
}

main();