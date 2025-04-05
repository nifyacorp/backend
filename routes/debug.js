/**
 * Debug routes for diagnosing issues
 */
const express = require('express');
const router = express.Router();
const { getClient } = require('../services/db-service');
const { getSubscriptionById } = require('../services/subscription-service');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connectivity check
router.get('/db-info', async (req, res) => {
  try {
    const client = await getClient();
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    res.json({
      status: 'connected',
      tables: tables.rows.map(row => row.tablename),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check if a subscription exists directly in the database
router.get('/subscription-test/subscription-exists/:id', async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    if (!subscriptionId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Subscription ID is required' 
      });
    }
    
    const client = await getClient();
    const result = await client.query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: `Subscription with ID ${subscriptionId} not found`,
        timestamp: new Date().toISOString()
      });
    }

    // Also check related tables
    const relatedTables = ['subscription_processing', 'notifications'];
    const relatedData = {};

    for (const table of relatedTables) {
      const related = await client.query(
        `SELECT COUNT(*) FROM ${table} WHERE subscription_id = $1`,
        [subscriptionId]
      );
      relatedData[table] = parseInt(related.rows[0].count, 10);
    }
    
    return res.json({
      status: 'found',
      subscription: result.rows[0],
      relatedData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for direct subscription deletion
router.post('/subscription-test/test-subscription-deletion', async (req, res) => {
  try {
    const { subscriptionId, userId, force = false } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Subscription ID is required' 
      });
    }
    
    const client = await getClient();
    
    // First check if subscription exists
    const checkResult = await client.query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: `Subscription with ID ${subscriptionId} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if the user owns the subscription or force override
    if (!force && userId) {
      const ownerCheck = await client.query(
        'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
      
      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({
          status: 'error',
          message: 'You do not have permission to delete this subscription',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Force delete from all related tables first
    await client.query('BEGIN');
    
    // Delete related records
    const relatedTables = [
      'subscription_processing',
      'subscription_shares',
      'notifications'
    ];
    
    const deletionResults = {};
    
    for (const table of relatedTables) {
      try {
        const deleteResult = await client.query(
          `DELETE FROM ${table} WHERE subscription_id = $1 RETURNING *`,
          [subscriptionId]
        );
        deletionResults[table] = {
          deleted: deleteResult.rowCount,
          success: true
        };
      } catch (error) {
        deletionResults[table] = {
          success: false,
          error: error.message
        };
        // Continue with other tables even if one fails
      }
    }
    
    // Finally delete the subscription itself
    try {
      const deleteResult = await client.query(
        'DELETE FROM subscriptions WHERE id = $1 RETURNING *',
        [subscriptionId]
      );
      
      deletionResults.subscriptions = {
        deleted: deleteResult.rowCount,
        success: deleteResult.rowCount > 0
      };
      
      await client.query('COMMIT');
      
      // Clear deletion blacklist entry if it exists
      try {
        await client.query(
          'DELETE FROM deletion_blacklist WHERE subscription_id = $1',
          [subscriptionId]
        );
      } catch (error) {
        // Table might not exist, just log and continue
        console.warn('Could not clear deletion blacklist:', error.message);
      }
      
      return res.json({
        status: 'success',
        message: `Subscription ${subscriptionId} deleted successfully`,
        results: deletionResults,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting subscription:', error);
      return res.status(500).json({
        status: 'error',
        message: `Error deleting subscription: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in direct subscription deletion endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clean deletion blacklist entries
router.post('/subscription-test/clean-deletion-blacklist', async (req, res) => {
  try {
    const client = await getClient();
    
    // Check if deletion_blacklist table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deletion_blacklist'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Create the table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS deletion_blacklist (
          id SERIAL PRIMARY KEY,
          subscription_id UUID NOT NULL,
          user_id UUID NOT NULL,
          deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      return res.json({
        status: 'success',
        message: 'Deletion blacklist table created, no entries to clean',
        timestamp: new Date().toISOString()
      });
    }
    
    // Clean the blacklist entries
    const deleteResult = await client.query('DELETE FROM deletion_blacklist RETURNING *');
    
    return res.json({
      status: 'success',
      message: `Cleaned ${deleteResult.rowCount} deletion blacklist entries`,
      entries: deleteResult.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning deletion blacklist:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check database status
router.get('/db-status', async (req, res) => {
  try {
    const client = await getClient();
    
    // Get database connection info
    const connInfo = await client.query('SELECT current_database(), current_user, version()');
    
    // Get table statistics
    const tableStats = await client.query(`
      SELECT 
        schemaname, 
        relname as table_name, 
        n_live_tup as row_count 
      FROM 
        pg_stat_user_tables 
      ORDER BY 
        n_live_tup DESC;
    `);
    
    return res.json({
      status: 'ok',
      connection: connInfo.rows[0],
      tables: tableStats.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking database status:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed subscription diagnostics for a user
router.get('/subscription-debug/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'User ID is required' 
      });
    }
    
    const client = await getClient();
    
    // Get all subscriptions for the user
    const subscriptions = await client.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    
    // Get counts from related tables
    const results = [];
    
    for (const sub of subscriptions.rows) {
      const relatedData = {};
      
      // Check notifications
      const notifications = await client.query(
        'SELECT COUNT(*) FROM notifications WHERE subscription_id = $1',
        [sub.id]
      );
      relatedData.notifications = parseInt(notifications.rows[0].count, 10);
      
      // Check processing records
      const processing = await client.query(
        'SELECT COUNT(*) FROM subscription_processing WHERE subscription_id = $1',
        [sub.id]
      );
      relatedData.processing = parseInt(processing.rows[0].count, 10);
      
      // Check sharing records
      const sharing = await client.query(
        'SELECT COUNT(*) FROM subscription_shares WHERE subscription_id = $1',
        [sub.id]
      );
      relatedData.sharing = parseInt(sharing.rows[0].count, 10);
      
      // Add to results
      results.push({
        subscription: sub,
        relatedData
      });
    }
    
    return res.json({
      status: 'ok',
      userId,
      subscriptionCount: subscriptions.rowCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in subscription diagnostics:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;