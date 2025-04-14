import { query, withTransaction } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';
import logger from '../../../shared/logger.js';
import subscriptionRepositoryInterface from '../interfaces/repository/subscription-repository.interface.js';

/**
 * Core implementation of the subscription repository
 * This is the primary implementation that should be used across the system
 */

/**
 * Create a subscription
 * @param {Object} subscription - The subscription data
 * @returns {Promise<Object>} - Created subscription with ID
 */
async function createSubscription(subscription) {
  try {
    // Normalize prompts to ensure they're in the right format
    let normalizedPrompts = subscription.prompts;
    
    if (typeof normalizedPrompts === 'string') {
      try {
        // Try to parse it as JSON if it's a string
        normalizedPrompts = JSON.parse(normalizedPrompts);
      } catch (e) {
        // If it's not valid JSON, treat it as a single prompt
        normalizedPrompts = [normalizedPrompts];
      }
    } else if (!Array.isArray(normalizedPrompts)) {
      // Ensure it's an array
      normalizedPrompts = normalizedPrompts ? [normalizedPrompts] : [];
    }
    
    // Convert to JSON string for database storage
    const promptsJson = JSON.stringify(normalizedPrompts);
    
    // Insert the subscription
    const text = `
      INSERT INTO subscriptions (
        name, 
        description, 
        user_id, 
        type_id, 
        prompts, 
        frequency, 
        active
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const params = [
      subscription.name,
      subscription.description || '',
      subscription.userId,
      subscription.typeId,
      promptsJson,
      subscription.frequency || 'daily',
      subscription.active !== undefined ? subscription.active : true
    ];
    
    // Execute the query
    const result = await query(text, params);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create subscription');
    }
    
    // Get the created subscription by ID
    return await findById(result.rows[0].id);
    
  } catch (error) {
    logger.error('Error creating subscription', { 
      error: error.message, 
      stack: error.stack, 
      subscription 
    });
    
    throw new AppError(
      SUBSCRIPTION_ERRORS.CREATE_ERROR.code,
      `Failed to create subscription: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get a subscription by ID
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @returns {Promise<Object|null>} - Subscription or null if not found
 */
async function findById(id, options = {}) {
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
          t.id as type_id,
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
          t.id as type_id,
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
    
    return formatSubscription(result.rows[0]);
  } catch (error) {
    logger.error('Error finding subscription by ID', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      userId 
    });
    
    throw new AppError(
      SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
      `Failed to fetch subscription: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Get subscriptions for a user
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} - Object with subscriptions array and pagination info
 */
async function getUserSubscriptions(userId, options = {}) {
  const context = options.context || {};
  logger.logInfo(context, '[DEBUG] Repository: Getting user subscriptions', { 
    userId, 
    options,
    timestamp: new Date().toISOString() 
  });
  
  try {
    // Normalize options
    const {
      active,
      type,
      search,
      limit = 20,
      page = 1,
      sort = 'created_at',
      order = 'desc'
    } = options;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Start building query
    let text = `
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
        t.id as type_id,
        t.name as type,
        t.display_name as type_name,
        t.icon as type_icon
      FROM 
        subscriptions s
      LEFT JOIN 
        subscription_types t ON s.type_id = t.id
      WHERE 
        s.user_id = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;
    
    // Add active filter if specified
    if (active !== undefined) {
      text += ` AND s.active = $${paramIndex}`;
      params.push(active);
      paramIndex++;
    }
    
    // Add type filter if specified
    if (type) {
      text += ` AND t.name = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    // Add search filter if specified
    if (search) {
      text += ` AND (s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Add ordering
    text += ` ORDER BY s.${sort} ${order}`;
    
    // Add pagination
    text += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    // Log the query for debugging
    logger.logInfo(context, '[DEBUG] Repository: Executing subscription query', {
      query: text.replace(/\s+/g, ' ').trim(),
      params: JSON.stringify(params),
      timestamp: new Date().toISOString()
    });
    
    // Execute the query
    const result = await query(text, params);
    logger.logInfo(context, '[DEBUG] Repository: Query results', {
      rowCount: result.rowCount,
      sampleIds: result.rows.slice(0, 5).map(row => row.id),
      allIds: result.rows.map(row => row.id),
      timestamp: new Date().toISOString()
    });
    
    // Direct DB check for recently deleted subscriptions
    // This will help identify why deleted subscriptions still appear in results
    if (result.rowCount > 0) {
      try {
        const ids = result.rows.map(row => row.id);
        const verifyQuery = `
          SELECT id, created_at, updated_at FROM subscriptions 
          WHERE id = ANY($1::uuid[])
        `;
        const verifyResult = await query(verifyQuery, [ids]);
        
        logger.logInfo(context, '[DEBUG] Repository: Verification of subscriptions', {
          requestedIds: ids,
          foundIds: verifyResult.rows.map(row => row.id),
          missingIds: ids.filter(id => !verifyResult.rows.some(row => row.id === id)),
          timestamp: new Date().toISOString()
        });
        
        // Check if any returned subscriptions don't actually exist in DB
        const missingIds = ids.filter(id => !verifyResult.rows.some(row => row.id === id));
        if (missingIds.length > 0) {
          logger.logInfo(context, '[DEBUG] Repository: Found phantom subscriptions', {
            phantomIds: missingIds,
            timestamp: new Date().toISOString()
          });
        }
      } catch (verifyError) {
        logger.error(context, '[DEBUG] Repository: Error verifying subscriptions', {
          error: verifyError.message,
          stack: verifyError.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Get total count for pagination
    const countText = `
      SELECT COUNT(*) as total
      FROM subscriptions s
      LEFT JOIN subscription_types t ON s.type_id = t.id
      WHERE s.user_id = $1
      ${active !== undefined ? ' AND s.active = $2' : ''}
      ${type ? ` AND t.name = $${active !== undefined ? 3 : 2}` : ''}
      ${search ? ` AND (s.name ILIKE $${
        (active !== undefined ? 1 : 0) + (type ? 1 : 0) + 2
      } OR s.description ILIKE $${
        (active !== undefined ? 1 : 0) + (type ? 1 : 0) + 2
      })` : ''}
    `;
    
    const countParams = [userId];
    if (active !== undefined) countParams.push(active);
    if (type) countParams.push(type);
    if (search) countParams.push(`%${search}%`);
    
    // Log the count query
    logger.logInfo(context, '[DEBUG] Repository: Executing count query', {
      query: countText.replace(/\s+/g, ' ').trim(),
      params: JSON.stringify(countParams),
      timestamp: new Date().toISOString()
    });
    
    const countResult = await query(countText, countParams);
    const total = parseInt(countResult.rows[0].total);
    logger.logInfo(context, '[DEBUG] Repository: Count result', { 
      total,
      timestamp: new Date().toISOString() 
    });
    
    // Format subscriptions
    const subscriptions = result.rows.map(formatSubscription);
    
    // Log the final result
    logger.logInfo(context, '[DEBUG] Repository: Final formatted subscriptions', {
      formattedCount: subscriptions.length,
      sampleFormattedIds: subscriptions.slice(0, 3).map(s => s.id),
      timestamp: new Date().toISOString()
    });
    
    return {
      subscriptions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(context, '[DEBUG] Repository: Error in getUserSubscriptions', { 
      error: error.message, 
      stack: error.stack, 
      userId, 
      options,
      timestamp: new Date().toISOString()
    });
    
    // Return empty results instead of throwing
    return {
      subscriptions: [],
      pagination: {
        total: 0,
        page: parseInt(options.page || 1),
        limit: parseInt(options.limit || 20),
        totalPages: 0
      }
    };
  }
}

/**
 * Update a subscription
 * @param {string} id - Subscription ID
 * @param {Object} data - Fields to update
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Updated subscription
 */
async function updateSubscription(id, data, options = {}) {
  const { userId } = options;
  
  try {
    // Verify subscription exists and user has permission
    const subscription = await findById(id, { withUserCheck: true, userId });
    
    if (!subscription) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId: id }
      );
    }
    
    // Prepare update fields
    const updateFields = [];
    const params = [];
    let paramIndex = 1;
    
    // Handle each field that can be updated
    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    
    if (data.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }
    
    if (data.typeId !== undefined) {
      updateFields.push(`type_id = $${paramIndex}`);
      params.push(data.typeId);
      paramIndex++;
    }
    
    if (data.prompts !== undefined) {
      // Normalize prompts
      let normalizedPrompts = data.prompts;
      
      if (typeof normalizedPrompts === 'string') {
        try {
          normalizedPrompts = JSON.parse(normalizedPrompts);
        } catch (e) {
          normalizedPrompts = [normalizedPrompts];
        }
      } else if (!Array.isArray(normalizedPrompts)) {
        normalizedPrompts = normalizedPrompts ? [normalizedPrompts] : [];
      }
      
      updateFields.push(`prompts = $${paramIndex}`);
      params.push(JSON.stringify(normalizedPrompts));
      paramIndex++;
    }
    
    if (data.frequency !== undefined) {
      updateFields.push(`frequency = $${paramIndex}`);
      params.push(data.frequency);
      paramIndex++;
    }
    
    if (data.active !== undefined) {
      updateFields.push(`active = $${paramIndex}`);
      params.push(data.active);
      paramIndex++;
    }
    
    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);
    
    // If no fields to update, return the existing subscription
    if (updateFields.length === 0) {
      return subscription;
    }
    
    // Add subscription ID and user ID for WHERE clause
    params.push(id);
    params.push(userId);
    
    // Build and execute update query
    const text = `
      UPDATE subscriptions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id
    `;
    
    const result = await query(text, params);
    
    if (result.rows.length === 0) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
        'Failed to update subscription - not found or not owned by user',
        404,
        { subscriptionId: id }
      );
    }
    
    // Get updated subscription
    return await findById(id);
    
  } catch (error) {
    logger.error('Error updating subscription', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      userId, 
      data 
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
      `Failed to update subscription: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Delete a subscription
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteSubscription(id, options = {}) {
  const { userId, force = false, context } = options;
  
  logger.logInfo(context, '[DEBUG] Starting subscription deletion process', { 
    subscriptionId: id, 
    userId,
    force,
    timestamp: new Date().toISOString() 
  });
  
  try {
    return await withTransaction(userId, async (client) => {
      // STEP 1: Debug the transaction state
      try {
        const txnStatus = await client.query('SELECT pg_current_xact_id_if_assigned() as txn_id');
        logger.logInfo(context, '[DEBUG] Transaction state', {
          subscriptionId: id,
          txn_id: txnStatus.rows[0]?.txn_id || 'No transaction ID assigned',
          timestamp: new Date().toISOString()
        });
      } catch (txnErr) {
        logger.logInfo(context, '[DEBUG] Failed to get transaction ID', {
          subscriptionId: id,
          error: txnErr.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Step 2: Check if subscription exists and user has permission
      const existsCheck = await client.query(
        'SELECT id, user_id FROM subscriptions WHERE id = $1',
        [id]
      );
      
      logger.logInfo(context, '[DEBUG] Existence check query results', {
        subscriptionId: id,
        rowCount: existsCheck.rowCount,
        row: existsCheck.rowCount > 0 ? existsCheck.rows[0] : null,
        timestamp: new Date().toISOString()
      });
      
      if (existsCheck.rowCount === 0) {
        logger.logInfo(context, '[DEBUG] Subscription not found for deletion', { 
          subscriptionId: id,
          timestamp: new Date().toISOString()
        });
        return {
          alreadyRemoved: true,
          message: 'Subscription not found'
        };
      }
      
      const subscription = existsCheck.rows[0];
      
      // Verify ownership if userId is provided and force is not true
      if (userId && !force && subscription.user_id !== userId) {
        logger.logInfo(context, '[DEBUG] Permission check failed', {
          subscriptionId: id,
          exists: true,
          ownershipVerified: false,
          ownerId: subscription.user_id,
          requesterId: userId,
          timestamp: new Date().toISOString()
        });
        
        throw new AppError(
          'PERMISSION_ERROR',
          'You do not have permission to delete this subscription',
          403
        );
      }
      
      logger.logInfo(context, '[DEBUG] Permission check passed', {
        subscriptionId: id,
        exists: true,
        ownershipVerified: true,
        ownerId: subscription.user_id,
        timestamp: new Date().toISOString()
      });
      
      // Delete related processing records 
      try {
        const processingResult = await client.query(
          'DELETE FROM subscription_processing WHERE subscription_id = $1 RETURNING id',
          [id]
        );
        
        logger.logInfo(context, '[DEBUG] Deleted related processing records', { 
          subscriptionId: id,
          recordsDeleted: processingResult.rowCount,
          idsDeleted: processingResult.rows.map(row => row.id),
          timestamp: new Date().toISOString()
        });
      } catch (processingError) {
        // Log but continue
        logger.error(context, '[DEBUG] Error deleting processing records', {
          error: processingError.message,
          stack: processingError.stack,
          subscriptionId: id,
          timestamp: new Date().toISOString()
        });
      }
      
      // Delete related notifications
      try {
        // Try different notification table structures
        let notificationResult;
        try {
          notificationResult = await client.query(
            'DELETE FROM notifications WHERE subscription_id = $1 RETURNING id',
            [id]
          );
          
          logger.logInfo(context, '[DEBUG] Deleted related notifications (direct column)', { 
            subscriptionId: id,
            recordsDeleted: notificationResult.rowCount,
            idsDeleted: notificationResult.rows.map(row => row.id),
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          // Try JSONB structure
          logger.logInfo(context, '[DEBUG] Direct column deletion failed, trying JSONB path', {
            subscriptionId: id,
            error: e.message,
            timestamp: new Date().toISOString()
          });
          
          notificationResult = await client.query(
            "DELETE FROM notifications WHERE data->>'subscription_id' = $1 RETURNING id",
            [id]
          );
          
          logger.logInfo(context, '[DEBUG] Deleted related notifications (JSONB)', { 
            subscriptionId: id,
            recordsDeleted: notificationResult.rowCount,
            idsDeleted: notificationResult.rows.map(row => row.id),
            timestamp: new Date().toISOString()
          });
        }
      } catch (notificationError) {
        // Log but continue
        logger.error(context, '[DEBUG] Error deleting related notifications', {
          error: notificationError.message,
          stack: notificationError.stack,
          subscriptionId: id,
          timestamp: new Date().toISOString()
        });
      }
      
      // Delete the subscription itself
      logger.logInfo(context, '[DEBUG] About to execute main subscription DELETE', {
        subscriptionId: id,
        sql: 'DELETE FROM subscriptions WHERE id = $1 RETURNING id, user_id, name',
        params: [id],
        timestamp: new Date().toISOString()
      });
      
      const deleteResult = await client.query(
        'DELETE FROM subscriptions WHERE id = $1 RETURNING id, user_id, name',
        [id]
      );
      
      logger.logInfo(context, '[DEBUG] Subscription deletion query results', { 
        subscriptionId: id,
        rowCount: deleteResult.rowCount,
        deletedRecords: deleteResult.rows,
        timestamp: new Date().toISOString()
      });
      
      // Final verification that the subscription no longer exists
      const verifyResult = await client.query(
        'SELECT id FROM subscriptions WHERE id = $1',
        [id]
      );
      
      logger.logInfo(context, '[DEBUG] Deletion verification', {
        subscriptionId: id,
        stillExists: verifyResult.rowCount > 0,
        verifyRowCount: verifyResult.rowCount,
        timestamp: new Date().toISOString()
      });
      
      // Verify there are no RLS policies or triggers that could be preventing deletion
      try {
        const rlsCheck = await client.query(`
          SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'subscriptions'
        `);
        
        logger.logInfo(context, '[DEBUG] RLS settings for subscriptions table', {
          subscriptionId: id,
          rlsInfo: rlsCheck.rows[0],
          timestamp: new Date().toISOString()
        });
        
        // Check triggers
        const triggerCheck = await client.query(`
          SELECT tgname, tgenabled FROM pg_trigger 
          JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
          WHERE relname = 'subscriptions'
        `);
        
        logger.logInfo(context, '[DEBUG] Triggers on subscriptions table', {
          subscriptionId: id,
          triggers: triggerCheck.rows,
          timestamp: new Date().toISOString()
        });
      } catch (metaErr) {
        logger.logInfo(context, '[DEBUG] Error checking table metadata', {
          subscriptionId: id,
          error: metaErr.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if the transaction is still active
      try {
        const txnCheckAfter = await client.query('SELECT pg_current_xact_id_if_assigned() as txn_id');
        logger.logInfo(context, '[DEBUG] Transaction state before commit', {
          subscriptionId: id,
          txn_id: txnCheckAfter.rows[0]?.txn_id || 'No transaction ID assigned',
          timestamp: new Date().toISOString()
        });
      } catch (txnErr) {
        logger.logInfo(context, '[DEBUG] Failed to get transaction ID before commit', {
          subscriptionId: id,
          error: txnErr.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // This is the last step in the transaction before it commits
      logger.logInfo(context, '[DEBUG] About to return from transaction callback', {
        subscriptionId: id,
        timestamp: new Date().toISOString()
      });
      
      return {
        deleted: true,
        id: id,
        rowCount: deleteResult.rowCount,
        timestamp: new Date().toISOString()
      };
    }, { 
      isolationLevel: 'SERIALIZABLE', // Use highest isolation level
      logger: logger,
      context: context
    });
  } catch (error) {
    logger.logInfo(context, '[DEBUG] Error in deleteSubscription transaction', {
      error: error.message,
      stack: error.stack,
      subscriptionId: id,
      userId,
      timestamp: new Date().toISOString()
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'DATABASE_ERROR',
      `Error deleting subscription: ${error.message}`,
      500
    );
  } finally {
    // Add additional verification outside the transaction
    try {
      logger.logInfo(context, '[DEBUG] Final verification after transaction', {
        subscriptionId: id,
        timestamp: new Date().toISOString()
      });
      
      const finalCheck = await query(
        'SELECT id, user_id FROM subscriptions WHERE id = $1',
        [id]
      );
      
      logger.logInfo(context, '[DEBUG] Subscription state after transaction', {
        subscriptionId: id,
        stillExists: finalCheck.rowCount > 0,
        rowDetails: finalCheck.rows[0],
        timestamp: new Date().toISOString()
      });
    } catch (finalErr) {
      logger.logInfo(context, '[DEBUG] Error in final verification', {
        subscriptionId: id,
        error: finalErr.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Get subscription statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Statistics object
 */
async function getSubscriptionStats(userId) {
  try {
    // Get total count
    const totalQuery = 'SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1';
    const totalResult = await query(totalQuery, [userId]);
    const total = parseInt(totalResult.rows[0].count);
    
    // Get active count
    const activeQuery = 'SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1 AND active = true';
    const activeResult = await query(activeQuery, [userId]);
    const active = parseInt(activeResult.rows[0].count);
    
    // Get inactive count
    const inactive = total - active;
    
    // Get counts by type
    const bySourceQuery = `
      SELECT 
        t.name as source, 
        COUNT(*) as count
      FROM 
        subscriptions s
      LEFT JOIN 
        subscription_types t ON s.type_id = t.id
      WHERE 
        s.user_id = $1
      GROUP BY 
        t.name
    `;
    
    const bySourceResult = await query(bySourceQuery, [userId]);
    
    const bySource = {};
    bySourceResult.rows.forEach(row => {
      bySource[row.source || 'unknown'] = parseInt(row.count);
    });
    
    // Get counts by frequency
    const byFrequencyQuery = `
      SELECT 
        frequency, 
        COUNT(*) as count
      FROM 
        subscriptions
      WHERE 
        user_id = $1
      GROUP BY 
        frequency
    `;
    
    const byFrequencyResult = await query(byFrequencyQuery, [userId]);
    
    const byFrequency = {};
    byFrequencyResult.rows.forEach(row => {
      byFrequency[row.frequency] = parseInt(row.count);
    });
    
    return {
      total,
      active,
      inactive,
      bySource,
      byFrequency
    };
  } catch (error) {
    logger.error('Error getting subscription stats', { 
      error: error.message, 
      stack: error.stack, 
      userId 
    });
    
    // Return default stats instead of throwing
    return {
      total: 0,
      active: 0,
      inactive: 0,
      bySource: {},
      byFrequency: {}
    };
  }
}

/**
 * Toggle subscription active status
 * @param {string} id - Subscription ID
 * @param {boolean} active - New active status
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Updated subscription
 */
async function toggleSubscriptionStatus(id, active, options = {}) {
  const { userId } = options;
  
  try {
    // Verify subscription exists and user has permission
    const subscription = await findById(id, { withUserCheck: true, userId });
    
    if (!subscription) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId: id }
      );
    }
    
    // Update active status
    const text = `
      UPDATE subscriptions
      SET active = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING id
    `;
    
    const result = await query(text, [active, id, userId]);
    
    if (result.rows.length === 0) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
        'Failed to toggle subscription status',
        500,
        { subscriptionId: id }
      );
    }
    
    // Get updated subscription
    return await findById(id);
    
  } catch (error) {
    logger.error('Error toggling subscription status', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      userId, 
      active 
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
      `Failed to toggle subscription status: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Share a subscription with another user
 * @param {string} id - Subscription ID
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} targetEmail - Email of user to share with
 * @param {string} [message] - Optional message
 * @returns {Promise<Object>} - Sharing result
 */
async function shareSubscription(id, ownerUserId, targetEmail, message = '') {
  try {
    // Verify subscription exists and user is the owner
    const subscription = await findById(id, { withUserCheck: true, userId: ownerUserId });
    
    if (!subscription) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId: id }
      );
    }
    
    // Find target user by email
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await query(userQuery, [targetEmail]);
    
    if (userResult.rows.length === 0) {
      throw new AppError(
        'USER_NOT_FOUND',
        'User with this email not found',
        404,
        { email: targetEmail }
      );
    }
    
    const targetUserId = userResult.rows[0].id;
    
    // Check if already shared
    const checkQuery = `
      SELECT id FROM subscription_shares 
      WHERE subscription_id = $1 AND target_user_id = $2
    `;
    
    const checkResult = await query(checkQuery, [id, targetUserId]);
    
    if (checkResult.rows.length > 0) {
      // Already shared, return success
      return {
        message: 'Subscription already shared with this user',
        subscriptionId: id,
        targetEmail,
        alreadyShared: true
      };
    }
    
    // Create sharing record
    const shareQuery = `
      INSERT INTO subscription_shares (
        subscription_id, 
        owner_user_id, 
        target_user_id, 
        message, 
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;
    
    const shareResult = await query(shareQuery, [id, ownerUserId, targetUserId, message]);
    
    if (shareResult.rows.length === 0) {
      throw new AppError(
        'SHARING_ERROR',
        'Failed to create sharing record',
        500,
        { subscriptionId: id, targetEmail }
      );
    }
    
    return {
      message: 'Subscription shared successfully',
      subscriptionId: id,
      targetEmail,
      alreadyShared: false
    };
    
  } catch (error) {
    logger.error('Error sharing subscription', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      ownerUserId, 
      targetEmail 
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'SHARING_ERROR',
      `Failed to share subscription: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Remove subscription sharing
 * @param {string} id - Subscription ID
 * @param {string} ownerUserId - Owner's user ID
 * @param {string} targetEmail - Email of user to remove sharing with
 * @returns {Promise<Object>} - Result of operation
 */
async function removeSubscriptionSharing(id, ownerUserId, targetEmail) {
  try {
    // Find target user by email
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await query(userQuery, [targetEmail]);
    
    if (userResult.rows.length === 0) {
      throw new AppError(
        'USER_NOT_FOUND',
        'User with this email not found',
        404,
        { email: targetEmail }
      );
    }
    
    const targetUserId = userResult.rows[0].id;
    
    // Remove sharing record
    const removeQuery = `
      DELETE FROM subscription_shares
      WHERE subscription_id = $1 
        AND owner_user_id = $2 
        AND target_user_id = $3
      RETURNING id
    `;
    
    const removeResult = await query(removeQuery, [id, ownerUserId, targetUserId]);
    
    if (removeResult.rows.length === 0) {
      return {
        message: 'Sharing record not found or already removed',
        subscriptionId: id,
        targetEmail,
        removed: false
      };
    }
    
    return {
      message: 'Sharing removed successfully',
      subscriptionId: id,
      targetEmail,
      removed: true
    };
    
  } catch (error) {
    logger.error('Error removing subscription sharing', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      ownerUserId, 
      targetEmail 
    });
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'SHARING_ERROR',
      `Failed to remove subscription sharing: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Process subscription (run search against data source)
 * @param {string} id - Subscription ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Processing result
 */
async function processSubscription(id, options = {}) {
  const { userId, transactionId } = options;
  
  try {
    // Verify subscription exists
    const subscription = await findById(id, { 
      withUserCheck: userId ? true : false, 
      userId 
    });
    
    if (!subscription) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId: id }
      );
    }
    
    // Record processing attempt
    const processingQuery = `
      INSERT INTO subscription_processing (
        subscription_id,
        processed_at,
        status,
        transaction_id
      )
      VALUES ($1, NOW(), $2, $3)
      RETURNING id
    `;
    
    await query(processingQuery, [id, 'processing', transactionId]);
    
    // In a real implementation, this would send the job to a worker
    // Here we just mark it as processed successfully
    
    // Update processing record
    const updateQuery = `
      UPDATE subscription_processing
      SET status = $1, completed_at = NOW()
      WHERE subscription_id = $2 AND transaction_id = $3
    `;
    
    await query(updateQuery, ['completed', id, transactionId]);
    
    return {
      message: 'Subscription processed successfully',
      subscriptionId: id,
      transactionId,
      status: 'completed'
    };
    
  } catch (error) {
    logger.error('Error processing subscription', { 
      error: error.message, 
      stack: error.stack, 
      id, 
      userId, 
      transactionId 
    });
    
    // Record processing failure
    try {
      const failureQuery = `
        UPDATE subscription_processing
        SET status = $1, error_message = $2, completed_at = NOW()
        WHERE subscription_id = $3 AND transaction_id = $4
      `;
      
      await query(failureQuery, ['failed', error.message, id, transactionId]);
    } catch (e) {
      logger.error('Error recording processing failure', {
        error: e.message,
        stack: e.stack,
        id,
        transactionId
      });
    }
    
    // Rethrow AppErrors
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'PROCESSING_ERROR',
      `Failed to process subscription: ${error.message}`,
      500,
      { originalError: error.message }
    );
  }
}

/**
 * Format a subscription object from database row
 * @param {Object} row - Database row
 * @returns {Object} - Formatted subscription
 */
function formatSubscription(row) {
  if (!row) return null;
  
  // Parse prompts if stored as JSON string
  let prompts = row.prompts;
  try {
    if (typeof prompts === 'string') {
      prompts = JSON.parse(prompts);
    }
  } catch (e) {
    // If it's not valid JSON, keep as is
    logger.logError({}, 'Error parsing prompts JSON', {
      error: e.message,
      subscriptionId: row.id,
      prompts
    });
  }
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    typeId: row.type_id,
    type: row.type,
    typeName: row.type_name,
    typeIcon: row.type_icon,
    prompts: prompts,
    frequency: row.frequency,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Export implementation that matches the interface
export default {
  createSubscription,
  findById,
  getUserSubscriptions,
  updateSubscription,
  deleteSubscription: deleteSubscription,
  getSubscriptionStats,
  toggleSubscriptionStatus,
  shareSubscription,
  removeSubscriptionSharing,
  processSubscription
}; 