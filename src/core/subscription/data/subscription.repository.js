/**
 * Subscription Repository
 * Handles data access for subscriptions
 */

import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * Create a new subscription in the database
 * @param {Object} data - Subscription data
 * @param {string} data.userId - User ID who owns the subscription
 * @param {string} data.name - Subscription name
 * @param {string} data.typeId - Subscription type ID
 * @param {string} data.description - Subscription description
 * @param {Array<string>} data.prompts - Array of prompt keywords
 * @param {string} data.frequency - Frequency of subscription updates
 * @param {boolean} data.active - Whether the subscription is active
 * @param {Object} options - Options for context and logging
 * @returns {Promise<Object>} Created subscription
 */
async function create(data, options = {}) {
  const context = options.context || {};
  
  try {
    const result = await query(
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
      RETURNING id, name, description, type_id, prompts, frequency, active, user_id, created_at, updated_at`,
      [
        data.name,
        data.description || '',
        data.typeId,
        JSON.stringify(data.prompts || []),
        data.frequency || 'daily',
        data.active !== undefined ? data.active : true,
        data.userId,
        new Date(),
        new Date()
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error(context, `Error creating subscription: ${error.message}`, { data });
    throw new AppError('DATABASE_ERROR', `Failed to create subscription: ${error.message}`, 500);
  }
}

/**
 * Get subscription by ID
 * @param {string} userId - User ID who owns the subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Options for context and logging
 * @returns {Promise<Object>} Subscription data
 */
async function getById(userId, subscriptionId, options = {}) {
  const context = options.context || {};
  
  try {
    const result = await query(
      `SELECT s.id, s.name, s.description, s.type_id, s.prompts,
        s.frequency, s.active, s.created_at, s.updated_at,
        t.name as type_name, t.icon as type_icon
      FROM subscriptions s
      LEFT JOIN subscription_types t ON s.type_id = t.id
      WHERE s.id = $1 AND s.user_id = $2`,
      [subscriptionId, userId]
    );
    
    if (result.rowCount === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(context, `Error fetching subscription by ID: ${error.message}`, {
      subscriptionId,
      userId
    });
    throw new AppError('DATABASE_ERROR', `Failed to fetch subscription: ${error.message}`, 500);
  }
}

/**
 * Get all subscriptions for a user with pagination and filtering
 * @param {string} userId - User ID
 * @param {Object} options - Filter and pagination options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.type - Filter by subscription type
 * @param {boolean} options.active - Filter by active status
 * @param {string} options.search - Search query
 * @param {string} options.sort - Sort field
 * @param {string} options.order - Sort order (asc/desc)
 * @returns {Promise<Object>} Subscription list with pagination
 */
async function getByUserId(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    active,
    search,
    sort = 'created_at',
    order = 'desc',
    context = {}
  } = options;
  
  try {
    // Build query components
    const offset = (page - 1) * limit;
    
    // Build WHERE clause
    const whereConditions = ['s.user_id = $1'];
    const queryParams = [userId];
    let paramIndex = 2;
    
    if (type) {
      whereConditions.push(`s.type_id = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }
    
    if (active !== undefined) {
      whereConditions.push(`s.active = $${paramIndex}`);
      queryParams.push(active);
      paramIndex++;
    }
    
    if (search) {
      whereConditions.push(`(
        s.name ILIKE $${paramIndex} OR
        s.description ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(s.prompts) p
          WHERE p ILIKE $${paramIndex}
        )
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Validate sort field to prevent SQL injection
    const validSortFields = ['name', 'created_at', 'updated_at', 'frequency'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    
    // Validate sort order to prevent SQL injection
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Count total matching subscriptions
    const countQuery = `
      SELECT COUNT(*) as total
      FROM subscriptions s
      WHERE ${whereClause}
    `;
    
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Get the subscriptions with pagination
    const subscriptionsQuery = `
      SELECT s.id, s.name, s.description, s.type_id, s.prompts,
        s.frequency, s.active, s.created_at, s.updated_at,
        t.name as type_name, t.icon as type_icon
      FROM subscriptions s
      LEFT JOIN subscription_types t ON s.type_id = t.id
      WHERE ${whereClause}
      ORDER BY s.${sortField} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const subscriptionsResult = await query(
      subscriptionsQuery,
      [...queryParams, limit, offset]
    );
    
    return {
      subscriptions: subscriptionsResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(context, `Error fetching user subscriptions: ${error.message}`, {
      userId,
      options
    });
    throw new AppError('DATABASE_ERROR', `Failed to fetch subscriptions: ${error.message}`, 500);
  }
}

/**
 * Update a subscription
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} data - Fields to update
 * @param {Object} options - Options for context and logging
 * @returns {Promise<Object>} Updated subscription
 */
async function update(userId, subscriptionId, data, options = {}) {
  const context = options.context || {};
  
  try {
    // Build the update query
    const updateFields = [];
    const queryParams = [subscriptionId, userId];
    let paramIndex = 3;
    
    // Add fields to update
    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      queryParams.push(data.name);
    }
    
    if (data.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      queryParams.push(data.description);
    }
    
    if (data.typeId !== undefined) {
      updateFields.push(`type_id = $${paramIndex++}`);
      queryParams.push(data.typeId);
    }
    
    if (data.prompts !== undefined) {
      updateFields.push(`prompts = $${paramIndex++}`);
      queryParams.push(JSON.stringify(data.prompts));
    }
    
    if (data.frequency !== undefined) {
      updateFields.push(`frequency = $${paramIndex++}`);
      queryParams.push(data.frequency);
    }
    
    if (data.active !== undefined) {
      updateFields.push(`active = $${paramIndex++}`);
      queryParams.push(data.active);
    }
    
    // Always update the updated_at timestamp
    updateFields.push(`updated_at = $${paramIndex++}`);
    queryParams.push(new Date());
    
    // If no fields to update, return early
    if (updateFields.length === 0) {
      return getById(userId, subscriptionId, options);
    }
    
    const updateQuery = `
      UPDATE subscriptions
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, description, type_id, prompts, frequency, active, created_at, updated_at
    `;
    
    const result = await query(updateQuery, queryParams);
    
    if (result.rowCount === 0) {
      throw new AppError(
        'NOT_FOUND',
        'Subscription not found or you do not have permission to update it',
        404
      );
    }
    
    // Get the updated subscription with type information
    return getById(userId, subscriptionId, options);
  } catch (error) {
    logger.error(context, `Error updating subscription: ${error.message}`, {
      subscriptionId,
      userId,
      updateData: data
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('DATABASE_ERROR', `Failed to update subscription: ${error.message}`, 500);
  }
}

/**
 * Delete a subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Options for context and logging
 * @param {string} options.userId - User ID for permission check
 * @returns {Promise<Object>} Deletion result
 */
async function deleteSubscription(subscriptionId, options = {}) {
  const { userId, context = {} } = options;
  
  try {
    // First check if the subscription exists and belongs to the user
    if (userId) {
      const checkQuery = 'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2';
      const checkResult = await query(checkQuery, [subscriptionId, userId]);
      
      if (checkResult.rowCount === 0) {
        throw new AppError(
          'NOT_FOUND',
          'Subscription not found or you do not have permission to delete it',
          404
        );
      }
    }
    
    // Delete the subscription
    const deleteQuery = 'DELETE FROM subscriptions WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [subscriptionId]);
    
    return {
      deleted: true,
      id: subscriptionId,
      rowCount: result.rowCount
    };
  } catch (error) {
    logger.error(context, `Error deleting subscription: ${error.message}`, {
      subscriptionId,
      userId
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('DATABASE_ERROR', `Failed to delete subscription: ${error.message}`, 500);
  }
}

export const subscriptionRepository = {
  create,
  getById,
  getByUserId,
  update,
  delete: deleteSubscription
}; 