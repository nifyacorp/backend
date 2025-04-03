/**
 * Script to diagnose and fix API inconsistency between subscription data and stats
 * 
 * This script verifies the discrepancy between subscription stats and actual
 * subscription data without using any mock data.
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

  console.log('\nRunning API inconsistency diagnosis...');
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
      console.error(`Stats endpoint failed with status: ${statsResponse.status}`);
      const errorText = await statsResponse.text();
      console.error(`Error details: ${errorText}`);
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
      console.error(`Subscriptions endpoint failed with status: ${subscriptionsResponse.status}`);
      const errorText = await subscriptionsResponse.text();
      console.error(`Error details: ${errorText}`);
      throw new Error(`Subscriptions endpoint failed with status: ${subscriptionsResponse.status}`);
    }
    
    const subscriptionsData = await subscriptionsResponse.json();
    const subscriptions = subscriptionsData.subscriptions || 
                          subscriptionsData.data?.subscriptions || 
                          subscriptionsData.data?.data || 
                          subscriptionsData.data || [];
    
    console.log('Subscriptions count:', subscriptions.length);
    
    // Compare the numbers
    console.log('\n3. Comparing stats vs. actual subscriptions...');
    console.log(`Stats shows total: ${statsData.total}`);
    console.log(`Actual subscriptions: ${subscriptions.length}`);
    
    // Check for specific data issues
    if (statsData.total !== subscriptions.length) {
      console.log('\nDISCREPANCY DETECTED: Stats total doesn\'t match actual subscriptions count!');
      console.log('\n4. Checking database schema for possible issues...');
      
      try {
        const dbStatusResponse = await fetch(`${baseUrl}/api/v1/diagnostics/db-status`, {
          method: 'GET',
          headers
        });
        
        if (dbStatusResponse.ok) {
          const dbStatus = await dbStatusResponse.json();
          console.log('Database status:', JSON.stringify(dbStatus, null, 2));
        }
        
        const dbTablesResponse = await fetch(`${baseUrl}/api/v1/diagnostics/db-tables`, {
          method: 'GET',
          headers
        });
        
        if (dbTablesResponse.ok) {
          const dbTables = await dbTablesResponse.json();
          console.log('Subscription table schema:', 
                      dbTables.tables?.subscriptions || 
                      dbTables.find(t => t.name === 'subscriptions') || 
                      'Not found');
        }
      } catch (diagnosticError) {
        console.error('Error checking database diagnostics:', diagnosticError);
      }
      
      console.log('\n5. Recommended actions:');
      console.log('- Check for broken RLS policies that might be filtering out subscriptions');
      console.log('- Verify that all subscriptions are properly associated with the user\'s ID');
      console.log('- Run database consistency checks to ensure subscription data is intact');
      console.log('- Update subscription statistics calculation to match actual subscription data');
      console.log('- Consider adding logging to subscription repository to trace data flow');
      
    } else {
      console.log('\nSUCCESS: Stats total matches actual subscriptions count.');
    }
    
  } catch (error) {
    console.error('Error testing subscription endpoints:', error);
  } finally {
    rl.close();
  }
}

main();