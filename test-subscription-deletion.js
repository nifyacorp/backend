/**
 * Test script for subscription deletion
 * This script tests the subscription deletion functionality 
 */

import dotenv from 'dotenv';
import { query, initializeDatabase } from './src/infrastructure/database/client.js';
import { subscriptionRepository } from './src/core/subscription/data/subscription.repository.js';

dotenv.config();

const TEST_USER_ID = process.env.TEST_USER_ID || 'db9a5f8d-c6a8-4c8c-8bc9-f67a6a133cd6';

// Main function
async function testSubscriptionDeletion() {
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
        'Created for deletion test',
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
    
    // Step 3: Delete the subscription
    console.log('Deleting subscription...');
    const context = { requestId: 'test-' + Date.now() };
    
    const deleteResult = await subscriptionRepository.delete(subscriptionId, {
      userId: TEST_USER_ID,
      context
    });
    
    console.log('Delete operation result:', deleteResult);
    
    // Step 4: Verify the subscription is gone
    const checkAfterDelete = await query(
      'SELECT id FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );
    
    if (checkAfterDelete.rows.length > 0) {
      console.error('ERROR: Subscription still exists after deletion!');
      console.log('Subscription data:', checkAfterDelete.rows[0]);
      
      // Additional delete attempt with force
      console.log('Attempting force delete...');
      const forceDeleteResult = await subscriptionRepository.delete(subscriptionId, {
        userId: TEST_USER_ID,
        force: true,
        context
      });
      
      console.log('Force delete result:', forceDeleteResult);
      
      // Check again
      const recheckAfterForce = await query(
        'SELECT id FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );
      
      if (recheckAfterForce.rows.length > 0) {
        console.error('ERROR: Subscription STILL exists after force deletion!');
        // Last resort: direct deletion
        await query('DELETE FROM subscriptions WHERE id = $1', [subscriptionId]);
      } else {
        console.log('SUCCESS: Subscription deleted after force attempt');
      }
    } else {
      console.log('SUCCESS: Subscription successfully deleted');
    }
    
    console.log('Test completed');
    process.exit(0);
  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

// Run the test
testSubscriptionDeletion();