/**
 * Subscription diagnostics endpoint
 * This file provides testing endpoints for subscription operations 
 */

import { query } from '../../../../infrastructure/database/client.js';
import logger from '../../../../shared/logger.js';
import { subscriptionRepository } from '../../../../core/subscription/data/subscription.repository.js';

export default async function subscriptionDiagnosticsRoutes(fastify) {
  /**
   * Test subscription deletion - this endpoint will create a test subscription 
   * and then attempt to delete it, returning detailed information
   */
  fastify.post('/test-subscription-deletion', async (request, reply) => {
    try {
      const userId = request.body?.userId;
      
      if (!userId) {
        return reply.code(400).send({
          status: 'error',
          message: 'userId is required'
        });
      }
      
      // First check if user exists
      const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);
      const userExists = userResult.rowCount > 0;
      
      // If user doesn't exist, create it
      if (!userExists) {
        try {
          await query(
            `INSERT INTO users (
              id,
              email,
              name,
              preferences,
              notification_settings
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              `test-${userId.substring(0,8)}@example.com`,
              `Test User ${userId.substring(0,8)}`,
              JSON.stringify({}),
              JSON.stringify({
                emailNotifications: true,
                emailFrequency: 'immediate',
                instantNotifications: true
              })
            ]
          );
          console.log(`Created test user for userId: ${userId}`);
        } catch (createUserError) {
          console.error('Error creating test user:', createUserError);
          return reply.code(500).send({
            status: 'error',
            message: 'Failed to create test user',
            error: createUserError.message
          });
        }
      }
      
      // Set context for queries
      const context = {
        requestId: `test-deletion-${Date.now()}`,
        path: '/diagnostics/test-subscription-deletion',
        method: 'POST',
        token: {
          sub: userId,
          userId
        }
      };
      
      // Check if any subscription type exists
      const typeResult = await query(
        `SELECT id FROM subscription_types WHERE LOWER(name) = 'boe' LIMIT 1`
      );
      
      let typeId;
      if (typeResult.rows.length > 0) {
        typeId = typeResult.rows[0].id;
      } else {
        // Create subscription type if it doesn't exist
        try {
          const createTypeResult = await query(
            `INSERT INTO subscription_types (name, description, is_system) 
              VALUES ('BOE', 'Spanish Official Gazette', true)
              RETURNING id`
          );
          typeId = createTypeResult.rows[0].id;
        } catch (typeError) {
          console.error('Error creating subscription type:', typeError);
          return reply.code(500).send({
            status: 'error',
            message: 'Failed to create test subscription type',
            error: typeError.message
          });
        }
      }
      
      // Create test subscription
      let subscriptionId;
      try {
        const testSubscriptionName = `Test Subscription ${Date.now()}`;
        
        const createResult = await query(
          `INSERT INTO subscriptions (
            name,
            description,
            type_id,
            prompts,
            frequency,
            active,
            user_id,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, name`,
          [
            testSubscriptionName,
            'Created for deletion test',
            typeId,
            JSON.stringify(['test keyword']),
            'daily',
            true,
            userId,
            new Date(),
            new Date()
          ]
        );
        
        if (!createResult.rows[0]) {
          throw new Error('Failed to create test subscription');
        }
        
        subscriptionId = createResult.rows[0].id;
        console.log('Created test subscription with ID:', subscriptionId);
      } catch (createError) {
        console.error('Error creating test subscription:', createError);
        return reply.code(500).send({
          status: 'error',
          message: 'Failed to create test subscription',
          error: createError.message
        });
      }
      
      // Verify the subscription exists
      let subscriptionExists = false;
      let subscriptionData = null;
      try {
        const verifyResult = await query(
          'SELECT id, name FROM subscriptions WHERE id = $1',
          [subscriptionId]
        );
        
        subscriptionExists = verifyResult.rowCount > 0;
        subscriptionData = verifyResult.rows[0];
        
        console.log('Verified subscription exists:', verifyResult.rows[0]);
      } catch (verifyError) {
        console.error('Error verifying subscription existence:', verifyError);
        return reply.code(500).send({
          status: 'error',
          message: 'Failed to verify subscription existence',
          error: verifyError.message,
          subscriptionId
        });
      }
      
      // Delete the subscription
      let deleteResult;
      let deleteError = null;
      try {
        console.log('Deleting subscription...');
        deleteResult = await subscriptionRepository.delete(subscriptionId, {
          userId,
          context
        });
        
        console.log('Delete operation result:', deleteResult);
      } catch (error) {
        console.error('Error deleting subscription:', error);
        deleteError = error;
        deleteResult = {
          error: error.message,
          stack: error.stack
        };
      }
      
      // Verify if the subscription is deleted
      let verifyAfterDelete;
      try {
        const checkAfterDelete = await query(
          'SELECT id FROM subscriptions WHERE id = $1',
          [subscriptionId]
        );
        
        verifyAfterDelete = {
          still_exists: checkAfterDelete.rowCount > 0,
          rowCount: checkAfterDelete.rowCount
        };
        
        if (checkAfterDelete.rowCount > 0) {
          console.error('ERROR: Subscription still exists after deletion!');
          
          // Force delete directly with SQL to clean up
          try {
            await query('DELETE FROM subscriptions WHERE id = $1', [subscriptionId]);
            
            // Verify if force delete worked
            const recheckAfterForce = await query(
              'SELECT id FROM subscriptions WHERE id = $1',
              [subscriptionId]
            );
            
            verifyAfterDelete.force_delete_attempted = true;
            verifyAfterDelete.still_exists_after_force = recheckAfterForce.rowCount > 0;
          } catch (forceDeleteError) {
            console.error('Error during force delete:', forceDeleteError);
            verifyAfterDelete.force_delete_error = forceDeleteError.message;
          }
        }
      } catch (verifyError) {
        console.error('Error verifying deletion:', verifyError);
        verifyAfterDelete = {
          error: verifyError.message,
          stack: verifyError.stack
        };
      }
      
      // Final result
      return {
        timestamp: new Date().toISOString(),
        user: {
          id: userId,
          exists: true
        },
        subscription: {
          id: subscriptionId,
          initial_verify: {
            exists: subscriptionExists,
            data: subscriptionData
          },
          deletion: {
            result: deleteResult,
            error: deleteError
          },
          verification_after_delete: verifyAfterDelete
        },
        summary: verifyAfterDelete && !verifyAfterDelete.still_exists ? 
          'SUCCESS: Subscription was properly deleted' : 
          'FAILURE: Subscription was not properly deleted'
      };
    } catch (error) {
      console.error('Unexpected error in test-subscription-deletion endpoint:', error);
      
      return reply.code(500).send({
        status: 'error',
        message: 'Unexpected error in test-subscription-deletion endpoint',
        error: error.message,
        stack: error.stack
      });
    }
  });
  
  /**
   * Check if a subscription exists
   */
  fastify.get('/subscription-exists/:id', async (request, reply) => {
    try {
      const subscriptionId = request.params.id;
      
      if (!subscriptionId) {
        return reply.code(400).send({
          status: 'error',
          message: 'Subscription ID is required'
        });
      }
      
      // Direct database check
      const result = await query(
        'SELECT id, name, user_id, active, created_at FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );
      
      if (result.rowCount === 0) {
        return {
          exists: false,
          id: subscriptionId,
          message: 'Subscription does not exist in the database'
        };
      }
      
      return {
        exists: true,
        id: subscriptionId,
        subscription: result.rows[0]
      };
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        message: 'Failed to check subscription existence',
        error: error.message,
        stack: error.stack
      });
    }
  });
}