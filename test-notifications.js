/**
 * This script helps test notifications by creating test notifications for a user
 * 
 * Usage: 
 * NODE_ENV=development node test-notifications.js USER_ID
 * 
 * Example:
 * NODE_ENV=development node test-notifications.js 65c6074d-dbc4-4091-8e45-b6aecffd9ab9
 */

// Import database client
const { query, setRLSContext } = require('./src/infrastructure/database/client');

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Please provide a user ID as an argument');
  process.exit(1);
}

console.log(`Creating test notifications for user: ${userId}`);

// Sample notification data
const notifications = [
  {
    title: 'New BOE Regulation',
    content: 'A new regulation has been published in BOE today that may interest you.',
    source_url: 'https://www.boe.es/diario_boe/',
    metadata: JSON.stringify({ source: 'boe', type: 'regulation' })
  },
  {
    title: 'Property Price Change',
    content: 'A property in your watchlist has changed its price.',
    source_url: 'https://example.com/property/123',
    metadata: JSON.stringify({ source: 'real-estate', type: 'price-change' })
  },
  {
    title: 'BOE Subscription Update',
    content: 'Your BOE subscription has found 3 new matching documents.',
    source_url: 'https://www.boe.es/diario_boe/',
    metadata: JSON.stringify({ source: 'boe', type: 'update' })
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

// Main function
async function main() {
  try {
    // Create notifications
    for (const notification of notifications) {
      await createNotification(userId, notification);
    }
    
    console.log('Test notifications created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main();