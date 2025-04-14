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
  logger.logInfo(context, 'Repository: Getting user subscriptions', { userId, options });
  
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
    logger.logInfo(context, 'Repository: Executing subscription query', {
      query: text.replace(/\s+/g, ' ').trim(),
      params: JSON.stringify(params)
    });
    
    // Execute the query
    const result = await query(text, params);
    logger.logInfo(context, 'Repository: Query results', {
      rowCount: result.rowCount,
      sampleIds: result.rows.slice(0, 5).map(row => row.id)
    });
    
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
    logger.logInfo(context, 'Repository: Executing count query', {
      query: countText.replace(/\s+/g, ' ').trim(),
      params: JSON.stringify(countParams)
    });
    
    const countResult = await query(countText, countParams);
    const total = parseInt(countResult.rows[0].total);
    logger.logInfo(context, 'Repository: Count result', { total });
    
    // Format subscriptions
    const subscriptions = result.rows.map(formatSubscription);
    
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
    logger.error(context, 'Error in getUserSubscriptions', { 
      error: error.message, 
      stack: error.stack, 
      userId, 
      options 
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
  
  logger.logInfo(context, 'Starting subscription deletion process', { subscriptionId: id, userId });
  
  try {
    return await withTransaction(userId, async (client) => {
      // Step 1: Check if subscription exists and user has permission
      const existsCheck = await client.query(
        'SELECT id, user_id FROM subscriptions WHERE id = $1',
        [id]
      );
      
      if (existsCheck.rowCount === 0) {
        logger.logInfo(context, 'Subscription not found for deletion', { subscriptionId: id });
        return {
          alreadyRemoved: true,
          message: 'Subscription not found'
        };
      }
      
      const subscription = existsCheck.rows[0];
      
      // Verify ownership if userId is provided and force is not true
      if (userId && !force && subscription.user_id !== userId) {
        logger.logInfo(context, 'Subscription existence and ownership check', {
          subscriptionId: id,
          exists: true,
          ownershipVerified: false,
          ownerId: subscription.user_id,
          requesterId: userId
        });
        
        throw new AppError(
          'PERMISSION_ERROR',
          'You do not have permission to delete this subscription',
          403
        );
      }
      
      logger.logInfo(context, 'Subscription existence and ownership check', {
        subscriptionId: id,
        exists: true,
        ownershipVerified: true,
        ownerId: subscription.user_id
      });
      
      // Delete related processing records 
      try {
        const processingResult = await client.query(
          'DELETE FROM subscription_processing WHERE subscription_id = $1',
          [id]
        );
        
        logger.logInfo(context, 'Deleted related processing records', { 
          subscriptionId: id,
          recordsDeleted: processingResult.rowCount 
        });
      } catch (processingError) {
        // Log but continue
        logger.error('Error deleting processing records', {
          error: processingError.message,
          stack: processingError.stack,
          subscriptionId: id
        });
      }
      
      // Delete related notifications
      try {
        // Try different notification table structures
        let notificationResult;
        try {
          notificationResult = await client.query(
            'DELETE FROM notifications WHERE subscription_id = $1',
            [id]
          );
        } catch (e) {
          // Try JSONB structure
          notificationResult = await client.query(
            "DELETE FROM notifications WHERE data->>'subscription_id' = $1",
            [id]
          );
        }
        
        logger.logInfo(context, 'Deleted related notifications', { 
          subscriptionId: id,
          recordsDeleted: notificationResult?.rowCount || 0 
        });
      } catch (notificationError) {
        // Log but continue
        logger.error('Error deleting related notifications', {
          error: notificationError.message,
          stack: notificationError.stack,
          subscriptionId: id
        });
      }
      
      // Delete the subscription itself
      const deleteResult = await client.query(
        'DELETE FROM subscriptions WHERE id = $1 RETURNING id',
        [id]
      );
      
      logger.logInfo(context, 'Subscription deleted successfully', { 
        subscriptionId: id,
        rowsAffected: deleteResult.rowCount
      });
      
      // Final verification that the subscription no longer exists
      const verifyResult = await client.query(
        'SELECT id FROM subscriptions WHERE id = $1',
        [id]
      );
      
      logger.logInfo(context, 'Deletion verification', {
        subscriptionId: id,
        stillExists: verifyResult.rowCount > 0
      });
      
      return {
        deleted: true,
        id: id,
        rowCount: deleteResult.rowCount
      };
    });
  } catch (error) {
    logger.logInfo(context, 'Error in deleteSubscription transaction', {
      error: error.message,
      stack: error.stack,
      subscriptionId: id,
      userId
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'DATABASE_ERROR',
      `Error deleting subscription: ${error.message}`,
      500
    );
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