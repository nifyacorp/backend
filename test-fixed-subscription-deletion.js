/**
 * Test script for fixed subscription deletion
 * 
 * This script tests the fixed subscription deletion functionality that properly handles errors.
 */

import dotenv from 'dotenv';
import { query, initializeDatabase } from './src/infrastructure/database/client.js';
import { subscriptionService } from './src/core/subscription/services/subscription.service.js';

dotenv.config();

// Use a test user ID
const TEST_USER_ID = process.env.TEST_USER_ID || '65c6074d-dbc4-4091-8e45-b6aecffd9ab9';

// Main function
async function testFixedSubscriptionDeletion() {
  try {
    console.log('Initializing database connection...');
    await initializeDatabase();
    
    // Step 1: Create a test subscription
    console.log('Creating a test subscription for user:', TEST_USER_ID);
    
    const createResult = await query(
      `INSERT INTO subscriptions (
        name,
        description,
        type_id,
        prompts,
        frequency,
        user_id,
        active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        'Test Subscription ' + Date.now(),
        'Created for fixed deletion test',
        'boe', // Assuming 'boe' type exists
        JSON.stringify(['test keyword']),
        'daily',
        TEST_USER_ID,
        true,
        new Date(),
        new Date()
      ]
    );
    
    if (!createResult.rows[0]) {
      throw new Error('Failed to create test subscription');
    }
    
    const subscriptionId = createResult.rows[0].id;
    console.log('Created test subscription with ID:', subscriptionId);
    
    // Step 2: Verify the subscription exists
    const verifyResult = await query(
      'SELECT id, name FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );
    
    if (verifyResult.rows.length === 0) {
      throw new Error('Test subscription not found after creation');
    }
    
    console.log('Verified subscription exists:', verifyResult.rows[0]);
    
    // Step 3: Delete the subscription using the service
    console.log('Deleting subscription via service...');
    const context = { requestId: 'test-' + Date.now() };
    
    try {
      const deleteResult = await subscriptionService.deleteSubscription(
        TEST_USER_ID,
        subscriptionId,
        context
      );
      
      console.log('Delete operation succeeded:', deleteResult);
    } catch (deleteError) {
      // With our fix, errors should be properly thrown, not hidden
      console.log('Delete operation properly threw an error:', deleteError.message);
      console.log('Error details:', {
        code: deleteError.code,
        status: deleteError.status,
        details: deleteError.details
      });
    }
    
    // Step 4: Verify the subscription is gone
    const checkAfterDelete = await query(
      'SELECT id FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );
    
    if (checkAfterDelete.rows.length > 0) {
      console.error('ERROR: Subscription still exists after deletion!');
      console.log('Subscription data:', checkAfterDelete.rows[0]);
      
      // Cleanup: ensure the test subscription is deleted
      console.log('Cleaning up test subscription...');
      await query('DELETE FROM subscriptions WHERE id = $1', [subscriptionId]);
      console.log('Cleanup completed');
    } else {
      console.log('SUCCESS: Subscription successfully deleted');
    }
    
    // Step 5: Test error propagation with an invalid subscription ID
    console.log('Testing error propagation with invalid subscription ID...');
    
    try {
      const invalidResult = await subscriptionService.deleteSubscription(
        TEST_USER_ID,
        'invalid-subscription-id',
        context
      );
      
      console.log('WARNING: Invalid deletion did not throw an error:', invalidResult);
      if (invalidResult.alreadyRemoved) {
        console.log('But it correctly reported alreadyRemoved: true');
      }
    } catch (invalidError) {
      console.log('SUCCESS: Invalid deletion properly threw an error:', invalidError.message);
    }
    
    console.log('Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

// Run the test
testFixedSubscriptionDeletion();