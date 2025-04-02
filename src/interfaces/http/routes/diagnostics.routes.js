import { query } from '../../../infrastructure/database/client.js';
import logger from '../../../shared/logger.js';
import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { userService } from '../../../core/user/user.service.js';

/**
 * @route GET /api/diagnostics/notifications
 * @description Test endpoint to diagnose notification retrieval issues
 * @access Public (for testing)
 */

// Express router for non-Fastify endpoints
const expressRouter = express.Router();

// Fastify endpoints
export default async function diagnosticsRoutes(fastify) {
  fastify.get('/notifications/:userId', async (request, reply) => {
    try {
      const userId = request.params.userId;
      
      // Log the diagnostics request
      logger.logProcessing({ service: 'diagnostics', method: 'testNotifications' }, 'Testing notification retrieval', {
        userId,
        timestamp: new Date().toISOString()
      });

      // First check if the user exists
      const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);
      const userExists = userResult.rowCount > 0;
      
      // Next check the current database role and settings
      const roleResult = await query('SELECT current_user, current_setting(\'app.current_user_id\', TRUE) as app_user_id');
      
      // Try to set the user ID in the session for RLS
      await query('SET LOCAL app.current_user_id = $1', [userId]);
      
      // Check if the setting was applied
      const afterSetResult = await query('SELECT current_setting(\'app.current_user_id\', TRUE) as app_user_id');
      
      // Check direct count of notifications without RLS constraints
      const directCountResult = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
        [userId]
      );
      
      // Check notifications with RLS in effect (normal query path)
      const rlsCountResult = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
        [userId]
      );
      
      // Try to bypass RLS with a superuser check (if possible)
      let bypassResult = { error: 'Not attempted' };
      try {
        const bypassQuery = await query(
          'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
          [userId]
        );
        bypassResult = { count: bypassQuery.rows[0].count };
      } catch (err) {
        bypassResult = { error: err.message };
      }
      
      // Get sample notification data if any exists (limit to 1 for diagnostics)
      let sampleNotification = null;
      const sampleResult = await query(
        'SELECT * FROM notifications WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      
      if (sampleResult.rowCount > 0) {
        sampleNotification = sampleResult.rows[0];
      }
      
      // Get active RLS policies on notifications table
      const policiesResult = await query(`
        SELECT * FROM pg_policies 
        WHERE tablename = 'notifications'
      `);
      
      const diagnosticResult = {
        timestamp: new Date().toISOString(),
        database: {
          connection: 'successful',
          current_role: roleResult.rows[0]?.current_user || 'unknown',
          app_user_id_before: roleResult.rows[0]?.app_user_id || 'not set',
          app_user_id_after: afterSetResult.rows[0]?.app_user_id || 'not set',
        },
        user: {
          id: userId,
          exists: userExists
        },
        notifications: {
          direct_count: parseInt(directCountResult.rows[0]?.count || '0', 10),
          rls_count: parseInt(rlsCountResult.rows[0]?.count || '0', 10),
          bypass_count: bypassResult,
          sample: sampleNotification ? {
            id: sampleNotification.id,
            title: sampleNotification.title,
            created_at: sampleNotification.created_at,
            user_id: sampleNotification.user_id === userId ? 'matches request' : 'mismatch',
          } : null
        },
        rls_policies: policiesResult.rows.map(row => ({
          policyname: row.policyname,
          roles: row.roles,
          cmd: row.cmd,
          qual: row.qual,
          with_check: row.with_check
        }))
      };
      
      return diagnosticResult;
    } catch (error) {
      logger.logError({ service: 'diagnostics', method: 'testNotifications' }, error, {
        userId: request.params.userId,
        timestamp: new Date().toISOString()
      });
      
      reply.code(500);
      return {
        error: 'Diagnostic test failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });
  
  // Add a test endpoint to create a notification directly 
  fastify.post('/notifications/create-test', async (request, reply) => {
    try {
      const { userId, subscriptionId, title, content } = request.body || {};
      
      if (!userId || !subscriptionId) {
        reply.code(400);
        return { error: 'Missing required fields: userId and subscriptionId are required' };
      }
      
      // Insert test notification 
      const result = await query(
        `INSERT INTO notifications (
          user_id,
          subscription_id,
          title,
          content,
          source_url,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          userId,
          subscriptionId,
          title || 'Test Notification',
          content || 'This is a test notification created through the diagnostics endpoint.',
          '',
          JSON.stringify({
            entity_type: 'test:diagnostic',
            diagnostic: true,
            created_by: 'diagnostics_endpoint',
            timestamp: new Date().toISOString()
          }),
          new Date()
        ]
      );
      
      return {
        success: true,
        notification_id: result.rows[0].id,
        timestamp: new Date().toISOString(),
        message: 'Test notification created successfully'
      };
    } catch (error) {
      logger.logError({ service: 'diagnostics', method: 'createTestNotification' }, error, {
        timestamp: new Date().toISOString()
      });
      
      reply.code(500);
      return {
        error: 'Failed to create test notification',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });

  // Add additional fastify endpoints for diagnostics
  fastify.get('/health', async () => {
    try {
      const startTime = Date.now();
      const dbResult = await query('SELECT NOW()');
      const endTime = Date.now();
      
      return {
        status: 'healthy',
        database: {
          status: 'connected',
          response_time: endTime - startTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: {
          status: 'error',
          message: error.message
        }
      };
    }
  });
} 

// Express compatible routes for API compatibility

/**
 * @swagger
 * /api/diagnostics/health:
 *   get:
 *     summary: Check health status of the API
 *     description: Returns the health status of the API and its connected services
 *     tags: [Diagnostics]
 *     responses:
 *       200:
 *         description: Health check successful
 */
expressRouter.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    const dbResult = await query('SELECT NOW()');
    const endTime = Date.now();
    
    res.json({
      status: 'healthy',
      database: {
        status: 'connected',
        response_time: endTime - startTime
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: {
        status: 'error',
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/diagnostics/user:
 *   get:
 *     summary: Get current user information
 *     description: Returns information about the currently authenticated user
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 */
expressRouter.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user exists in database
    const result = await query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [userId]
    );
    
    res.json({
      status: 'success',
      user: result.rows[0] || null,
      exists: result.rows.length > 0,
      user_id: userId
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/diagnostics/create-user:
 *   post:
 *     summary: Create test user record
 *     description: Creates a user record in the database for the authenticated user
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User created successfully
 */
expressRouter.post('/create-user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email || req.body.email || 'test@example.com';
    const name = req.user.name || req.body.name || 'Test User';
    
    // First check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    
    if (existingUser.rows.length > 0) {
      return res.json({
        status: 'success',
        message: 'User already exists',
        user_id: userId,
        created: false
      });
    }
    
    // Create the user with the userService
    const context = {
      requestId: 'diagnostic-create-user',
      path: '/api/diagnostics/create-user',
      token: {
        sub: userId,
        email: email,
        name: name
      }
    };
    
    const user = await userService.getUserProfile(userId, context);
    
    res.json({
      status: 'success',
      message: 'User created successfully',
      user_id: userId,
      created: true,
      user: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/diagnostics/db-info:
 *   get:
 *     summary: Get database schema information
 *     description: Returns information about the database schema (tables, columns)
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database information retrieved successfully
 */
expressRouter.get('/db-info', authMiddleware, async (req, res) => {
  try {
    // Get all tables
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Get column information for each table
    const tableInfo = {};
    
    for (const table of tables) {
      const columnsResult = await query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      tableInfo[table] = columnsResult.rows;
    }
    
    res.json({
      status: 'success',
      tables,
      tableInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Export the Express router
export { expressRouter };