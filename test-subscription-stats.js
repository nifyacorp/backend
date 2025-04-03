/**
 * Script to test the subscription stats endpoint
 * 
 * This is a simple script to verify that the subscription stats endpoint
 * is returning the correct data when the subscriptions count doesn't match
 * the stats.
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

  console.log('Testing subscription stats endpoint...');
  console.log('Using base URL:', baseUrl);
  console.log('Using user ID:', userId);

  try {
    // Test the stats endpoint
    console.log('\n1. Testing subscription stats endpoint...');
    const statsResponse = await fetch(`${baseUrl}/api/v1/subscriptions/stats`, {
      method: 'GET',
      headers
    });
    
    if (!statsResponse.ok) {
      throw new Error(`Stats endpoint failed with status: ${statsResponse.status}`);
    }
    
    const statsData = await statsResponse.json();
    console.log('Stats response:', JSON.stringify(statsData, null, 2));
    
    // Test the subscriptions endpoint
    console.log('\n2. Testing subscriptions endpoint...');
    const subscriptionsResponse = await fetch(`${baseUrl}/api/v1/subscriptions`, {
      method: 'GET',
      headers
    });
    
    if (!subscriptionsResponse.ok) {
      throw new Error(`Subscriptions endpoint failed with status: ${subscriptionsResponse.status}`);
    }
    
    const subscriptionsData = await subscriptionsResponse.json();
    console.log('Subscriptions count:', subscriptionsData.subscriptions?.length || 0);
    
    // Compare the numbers
    console.log('\n3. Comparing stats vs. actual subscriptions...');
    console.log(`Stats shows total: ${statsData.total}`);
    console.log(`Actual subscriptions: ${subscriptionsData.subscriptions?.length || 0}`);
    
    if (statsData.isMockData) {
      console.log('WARNING: Stats response contains mock data!');
    }
    
    if (subscriptionsData.isMockData) {
      console.log('WARNING: Subscriptions response contains mock data!');
    }
    
    if (statsData.total !== (subscriptionsData.subscriptions?.length || 0)) {
      console.log('DISCREPANCY DETECTED: Stats total doesn\'t match actual subscriptions count!');
      
      if (subscriptionsData.pagination?.total !== (subscriptionsData.subscriptions?.length || 0)) {
        console.log(`Pagination total (${subscriptionsData.pagination?.total}) also doesn't match the actual count!`);
      }
    } else {
      console.log('SUCCESS: Stats total matches actual subscriptions count.');
    }
    
  } catch (error) {
    console.error('Error testing subscription endpoints:', error);
  } finally {
    rl.close();
  }
}

main();