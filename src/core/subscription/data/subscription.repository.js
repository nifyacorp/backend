/**
 * Improved Subscription Repository with better error handling and transaction support
 */

import { query, withTransaction } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

class SubscriptionRepository {
  /**
   * Find a subscription by ID
   * 
   * @param {string} id - Subscription ID
   * @param {object} options - Options
   * @param {boolean} options.withUserCheck - Whether to check user ownership
   * @param {string} options.userId - User ID for ownership check
   * @param {object} options.context - Logging context
   * @returns {Promise<object|null>} - Subscription object or null if not found
   */
  async findById(id, options = {}) {
    const { withUserCheck = true, userId, context } = options;
    
    try {
      // Build query based on whether we need to check user ownership
      let text, params;
      
      if (withUserCheck && userId) {
        text = `
          SELECT 
            s.id, 
            s.name, 
            s.description, 
            s.user_id, 
            s.prompts, 
            s.frequency, 
            s.active,
            s.created_at, 
            s.updated_at,
            t.name as type,
            t.display_name as type_name,
            t.icon as type_icon
          FROM 
            subscriptions s
          LEFT JOIN 
            subscription_types t ON s.type_id = t.id
          WHERE 
            s.id = $1 AND s.user_id = $2
        `;
        params = [id, userId];
      } else {
        text = `
          SELECT 
            s.id, 
            s.name, 
            s.description, 
            s.user_id, 
            s.prompts, 
            s.frequency, 
            s.active,
            s.created_at, 
            s.updated_at,
            t.name as type,
            t.display_name as type_name,
            t.icon as type_icon
          FROM 
            subscriptions s
          LEFT JOIN 
            subscription_types t ON s.type_id = t.id
          WHERE 
            s.id = $1
        `;
        params = [id];
      }
      
      const result = await query(text, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.formatSubscription(result.rows[0]);
    } catch (error) {
      logError(context, error, `Error finding subscription by ID: ${id}`);
      throw new AppError(
        'DATABASE_ERROR',
        `Database error: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Delete a subscription and its related records within a transaction
   * 
   * @param {string} id - Subscription ID
   * @param {object} options - Options
   * @param {string} options.userId - User ID (for ownership check)
   * @param {boolean} options.force - Whether to force deletion (bypass ownership check)
   * @param {object} options.context - Logging context
   * @returns {Promise<object>} - Deletion result
   */
  async delete(id, options = {}) {
    const { userId, force = false, context } = options;
    
    try {
      return await withTransaction(userId, async (client) => {
        // Step 1: Check if subscription exists and user has permission
        let subscriptionExists = false;
        let ownershipVerified = false;
        
        // Start with a detailed log message
        logRequest(context, 'Starting subscription deletion transaction', { 
          subscriptionId: id, 
          userId, 
          force 
        });
        
        try {
          // First check with user constraint (if userId provided and force is false)
          let ownershipCheckQuery;
          let ownershipParams;
          
          if (userId && !force) {
            ownershipCheckQuery = 'SELECT id, user_id FROM subscriptions WHERE id = $1 AND user_id = $2';
            ownershipParams = [id, userId];
          } else {
            ownershipCheckQuery = 'SELECT id, user_id FROM subscriptions WHERE id = $1';
            ownershipParams = [id];
          }
          
          const checkResult = await client.query(ownershipCheckQuery, ownershipParams);
          
          if (checkResult.rows.length > 0) {
            subscriptionExists = true;
            
            if (!userId) {
              // No user check required
              ownershipVerified = true;
            } else if (userId && !force) {
              // User ownership verified by the SQL where clause
              ownershipVerified = true;
            } else {
              // Force mode, check if user is subscription owner or admin
              const subscription = checkResult.rows[0];
              
              if (subscription.user_id === userId) {
                ownershipVerified = true;
              } else {
                // Check if user is admin
                const adminCheck = await client.query(
                  'SELECT role FROM users WHERE id = $1 AND role = $2',
                  [userId, 'admin']
                );
                
                ownershipVerified = adminCheck.rows.length > 0;
              }
            }
            
            logRequest(context, 'Subscription existence and ownership check', { 
              subscriptionId: id, 
              exists: subscriptionExists,
              ownershipVerified,
              ownerId: checkResult.rows[0].user_id
            });
          } else {
            logRequest(context, 'Subscription not found', { subscriptionId: id });
          }
        } catch (checkError) {
          logError(context, checkError, 'Error checking subscription existence');
          throw new AppError(
            'DATABASE_ERROR',
            `Error verifying subscription: ${checkError.message}`,
            500,
            { originalError: checkError.message }
          );
        }
        
        // Handle non-existent subscription
        if (!subscriptionExists) {
          return { 
            message: 'Subscription already removed',
            id,
            alreadyRemoved: true
          };
        }
        
        // Handle permission error
        if (!ownershipVerified && !force) {
          throw new AppError(
            'PERMISSION_ERROR',
            'You do not have permission to delete this subscription',
            403,
            { subscriptionId: id }
          );
        }
        
        // Step 2: Delete the subscription and related records
        try {
          // First, delete subscription sharing records if the table exists
          try {
            // Check if subscription_shares table exists
            const tableCheckResult = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'subscription_shares'
              ) as exists
            `);
            
            const sharingTableExists = tableCheckResult.rows[0].exists;
            
            if (sharingTableExists) {
              // Delete sharing records
              await client.query(
                'DELETE FROM subscription_shares WHERE subscription_id = $1',
                [id]
              );
              
              logRequest(context, 'Deleted related sharing records', { subscriptionId: id });
            }
          } catch (sharingError) {
            // Log but continue - don't fail the whole operation
            logError(context, sharingError, 'Error deleting sharing records');
          }
          
          // Delete related processing records 
          await client.query(
            'DELETE FROM subscription_processing WHERE subscription_id = $1',
            [id]
          );
          
          logRequest(context, 'Deleted related processing records', { subscriptionId: id });
          
          // Delete related notifications
          try {
            // First try with JSONB operator
            await client.query(
              'DELETE FROM notifications WHERE data->\'subscription_id\' = $1::jsonb',
              [JSON.stringify(id)]
            );
            
            // Also try with text comparison in case data format is different
            await client.query(
              "DELETE FROM notifications WHERE data->>'subscription_id' = $1",
              [id]
            );
            
            logRequest(context, 'Deleted related notifications', { subscriptionId: id });
          } catch (notificationError) {
            // Log but continue - don't fail the whole operation because of notifications
            logError(context, notificationError, 'Error deleting related notifications');
          }
          
          // Delete the subscription itself
          const deleteResult = await client.query(
            'DELETE FROM subscriptions WHERE id = $1 RETURNING id',
            [id]
          );
          
          // Verify deletion was successful by checking if any rows were returned
          if (deleteResult.rowCount === 0) {
            // Double-check if the subscription still exists
            const verifyResult = await client.query(
              'SELECT EXISTS(SELECT 1 FROM subscriptions WHERE id = $1) as exists',
              [id]
            );
            
            if (verifyResult.rows[0].exists) {
              // Subscription still exists, something went wrong with deletion
              logError(context, new Error('Deletion query did not affect any rows but subscription still exists'), {
                subscriptionId: id
              });
              
              // Try one more time with a direct DELETE
              const forcedDeleteResult = await client.query(
                'DELETE FROM subscriptions WHERE id = $1',
                [id]
              );
              
              if (forcedDeleteResult.rowCount === 0) {
                throw new Error('Failed to delete subscription after multiple attempts');
              } else {
                logRequest(context, 'Subscription deleted on second attempt', { 
                  subscriptionId: id,
                  rowsAffected: forcedDeleteResult.rowCount
                });
              }
            } else {
              // Subscription doesn't exist, it may have been deleted concurrently
              logRequest(context, 'No rows affected by deletion, subscription already gone', {
                subscriptionId: id
              });
            }
          } else {
            logRequest(context, 'Subscription deleted successfully', { 
              subscriptionId: id,
              rowsAffected: deleteResult.rowCount
            });
          }
          
          // Explicitly commit the transaction to ensure changes are persisted
          await client.query('COMMIT');
          
          return { 
            message: 'Subscription deleted successfully',
            id,
            alreadyRemoved: false
          };
        } catch (deleteError) {
          logError(context, deleteError, 'Error during subscription deletion');
          throw new AppError(
            'DATABASE_ERROR',
            `Error deleting subscription: ${deleteError.message}`,
            500,
            { originalError: deleteError.message }
          );
        }
      }, { 
        logger: { error: logError, info: logRequest }, 
        context,
        isolationLevel: 'SERIALIZABLE' // Use highest isolation level to prevent conflicts
      });
    } catch (error) {
      logError(context, error, 'Transaction error during subscription deletion');
      
      // Special case for HTTP errors - rethrow them
      if (error instanceof AppError) {
        throw error;
      }
      
      // For other errors, wrap in AppError
      throw new AppError(
        'SUBSCRIPTION_DELETION_ERROR',
        `Failed to delete subscription: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Format a subscription row from the database
   * 
   * @param {object} row - Database row
   * @returns {object} - Formatted subscription
   */
  formatSubscription(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      prompts: row.prompts,
      userId: row.user_id,
      type: row.type,
      typeName: row.type_name,
      typeIcon: row.type_icon,
      frequency: row.frequency,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const subscriptionRepository = new SubscriptionRepository();