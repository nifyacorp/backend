/**
 * This script helps test notifications by creating test notifications for a user
 * and testing title extraction and deletion functionality
 * 
 * Usage: 
 * NODE_ENV=development node test-notifications.js USER_ID
 * 
 * Example:
 * NODE_ENV=development node test-notifications.js 65c6074d-dbc4-4091-8e45-b6aecffd9ab9
 */

// Import database client
const { query, setRLSContext } = require('./src/infrastructure/database/client');
const notificationService = require('./services/notification-service');
const logger = require('./utils/logger');

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Please provide a user ID as an argument');
  process.exit(1);
}

console.log(`Creating test notifications for user: ${userId}`);

// Sample notification data including complex cases
const notifications = [
  {
    title: 'New BOE Regulation',
    content: 'A new regulation has been published in BOE today that may interest you.',
    source_url: 'https://www.boe.es/diario_boe/',
    metadata: JSON.stringify({ source: 'boe', type: 'regulation' })
  },
  {
    // No title field to test title extraction
    content: 'A notification without a clear title field to test extraction logic.',
    source_url: 'https://example.com/property/123',
    metadata: JSON.stringify({ 
      entity_type: 'property', 
      subscription_name: 'My Property Alerts',
      action: 'price-change' 
    })
  },
  {
    // BOE notification with nested title structure
    content: 'Test of nested metadata structure for BOE notifications',
    source_url: 'https://www.boe.es/diario_boe/',
    metadata: JSON.stringify({ 
      source: 'boe', 
      entity_type: 'BOE',
      metadata: {
        boe_data: {
          title: 'Deeply Nested BOE Title',
          documentId: 'ABC123'
        }
      }
    })
  },
  {
    // Complex notification with multiple potential title sources
    content: 'Testing multiple potential title fields',
    source_url: 'https://example.com/test',
    metadata: JSON.stringify({
      message_title: 'Message Title Field',
      notification_title: 'Notification Title Field',
      subject: 'Subject Field',
      data: {
        result: {
          title: 'Deeply Nested Title'
        }
      }
    })
  },
  {
    // Complete edge case with minimal data
    content: 'Edge case with minimal data',
    metadata: JSON.stringify({ timestamp: new Date().toISOString() })
  }
];

// Function to create a notification
async function createNotification(userId, notification) {
  try {
    // Set RLS context 
    await setRLSContext(null); // Use null to bypass RLS for this admin action
    
    // Insert notification
    const insertQuery = `
      INSERT INTO notifications (
        user_id, 
        subscription_id, 
        title, 
        content, 
        source_url, 
        metadata, 
        read, 
        created_at
      ) VALUES (
        $1, 
        $2, 
        $3, 
        $4, 
        $5, 
        $6::jsonb, 
        $7, 
        $8
      ) RETURNING id;
    `;

    // Use a dummy subscription ID or find a real one
    // For testing purposes, we'll find an existing subscription or use a dummy one
    const subscriptions = await query(`
      SELECT id FROM subscriptions WHERE user_id = $1 LIMIT 1
    `, [userId]);
    
    let subscriptionId = '00000000-0000-0000-0000-000000000000';
    if (subscriptions.rows.length > 0) {
      subscriptionId = subscriptions.rows[0].id;
    }
    
    // Create a random date within the last week
    const days = Math.floor(Math.random() * 7);
    const hours = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(date.getHours() - hours);
    
    // Insert with a 50% chance of being read
    const isRead = Math.random() > 0.5;
    
    const result = await query(insertQuery, [
      userId,
      subscriptionId,
      notification.title,
      notification.content,
      notification.source_url,
      notification.metadata,
      isRead,
      date.toISOString()
    ]);
    
    console.log(`Created notification: ${result.rows[0].id} - ${notification.title}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Test notification deletion functionality
async function testDeletion(notificationIds) {
  console.log('\n--- Starting deletion tests ---');
  
  // Test deletion of a single notification
  if (notificationIds.length > 0) {
    const idToDelete = notificationIds[0];
    try {
      console.log(`Testing single deletion for notification: ${idToDelete}`);
      const result = await notificationService.deleteNotification(idToDelete, userId);
      console.log(`Deletion result: ${result ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.error(`Error deleting notification ${idToDelete}:`, error.message);
    }
  }
  
  // Test deletion of a non-existent notification (should handle gracefully)
  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    console.log(`Testing deletion of non-existent notification: ${fakeId}`);
    const result = await notificationService.deleteNotification(fakeId, userId);
    console.log(`Non-existent deletion result: ${result ? 'Success' : 'Failed'}`);
  } catch (error) {
    console.error('Error in non-existent deletion test:', error.message);
  }
  
  // Test bulk deletion
  try {
    console.log('Testing bulk deletion');
    const deleteCount = await notificationService.deleteAllNotifications(userId);
    console.log(`Bulk deletion removed ${deleteCount} notifications`);
  } catch (error) {
    console.error('Error in bulk deletion test:', error.message);
  }
}

// Main function
async function main() {
  try {
    // Create notifications
    const createdIds = [];
    for (const notification of notifications) {
      const id = await createNotification(userId, notification);
      createdIds.push(id);
    }
    
    console.log('Test notifications created successfully');
    
    // Wait a moment to simulate real-world delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test notification retrieval
    console.log('\n--- Retrieving notifications ---');
    const userNotifications = await notificationService.getUserNotifications(userId, {
      includeRead: true
    });
    
    // Log title information to verify extraction
    console.log(`Retrieved ${userNotifications.length} notifications`);
    userNotifications.forEach(notification => {
      console.log(`Notification ID: ${notification.id}`);
      console.log(`Title info: ${notification.title || 'No title'}`);
      console.log(`Content: ${JSON.stringify(notification.content).substring(0, 50)}...`);
      console.log('---');
    });
    
    // Test deletion functionality
    await testDeletion(createdIds);
    
    console.log('\nAll tests completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main();