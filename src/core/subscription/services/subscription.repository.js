import { query, withTransaction } from '../../../infrastructure/database/client.js';
import { logError, logRequest } from '../../../shared/logging/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../../../core/subscription/types/subscription.types.js';

export class SubscriptionRepository {
  /**
   * Delete a subscription by ID using a transaction.
   * @param {string} subscriptionId - ID of subscription to delete
   * @param {object} options - Options for the delete operation
   * @param {string} options.userId - User ID performing the deletion
   * @param {boolean} options.force - If true, bypass user ownership check (admin only)
   * @param {object} options.client - Optional: Existing transaction client (if called within a larger transaction)
   * @param {object} context - Request context for logging
   * @returns {Promise<object>} - Result of the deletion operation
   */
  async delete(subscriptionId, options = {}, context = {}) {
    const { userId, force = false, client: existingClient } = options;
    const logger = context?.logger || console; // Use context logger if available
    
    if (!subscriptionId) {
      throw new AppError('VALIDATION_ERROR', 'Subscription ID is required');
    }
    
    if (!userId && !force) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required unless using force option');
    }
    
    logger.info('Repository: Attempting to delete subscription', { subscriptionId, userId, force });

    // Define the core deletion logic to be run within a transaction
    const deleteLogic = async (txClient) => {
      // 1. Check if the subscription exists and belongs to the user (unless force=true)
      const checkQuery = `
        SELECT user_id FROM subscriptions 
        WHERE id = $1
      `;
      const checkResult = await txClient.query(checkQuery, [subscriptionId]);

      if (checkResult.rowCount === 0) {
        logger.warn(`Repository: Subscription ${subscriptionId} not found during delete attempt.`);
        return { alreadyRemoved: true, message: 'Subscription not found' };
      }

      const ownerId = checkResult.rows[0].user_id;
      if (!force && ownerId !== userId) {
        logger.warn(`Repository: User ${userId} attempted to delete subscription ${subscriptionId} owned by ${ownerId}`);
        throw new AppError('FORBIDDEN', 'Permission denied to delete this subscription', 403);
      }

      // 2. Delete dependent records (adjust table names if needed)
      // Example: Delete notifications associated with the subscription
      // Consider adding other dependent deletes here (e.g., subscription_processing)
      logger.info('Repository: Deleting dependent notifications', { subscriptionId });
      await txClient.query('DELETE FROM notifications WHERE subscription_id = $1', [subscriptionId]);
      logger.info('Repository: Deleting dependent processing records', { subscriptionId });
      await txClient.query('DELETE FROM subscription_processing WHERE subscription_id = $1', [subscriptionId]);
      // Add other dependencies as needed

      // 3. Delete the main subscription record
      logger.info('Repository: Deleting main subscription record', { subscriptionId });
      const deleteResult = await txClient.query(
        `DELETE FROM subscriptions WHERE id = $1 RETURNING id, name`,
        [subscriptionId]
      );

      if (deleteResult.rowCount === 0) {
        // This shouldn't happen if the initial check passed, but handle defensively
        logger.warn(`Repository: Subscription ${subscriptionId} disappeared during transaction?`);
        return { alreadyRemoved: true, message: 'Subscription was removed during operation' };
      }

      logger.info(`Repository: Successfully deleted subscription ${subscriptionId}`);
      return {
        alreadyRemoved: false,
        deleted: true,
        subscription: deleteResult.rows[0]
      };
    };

    try {
      // Execute the logic within a transaction
      // Pass userId for RLS context within the transaction
      // Pass logger and context for better logging within withTransaction
      const result = await withTransaction(userId, deleteLogic, { logger, context });
      return result;
    } catch (error) {
      logger.error('Repository: Error during delete transaction execution', { 
        subscriptionId, 
        userId, 
        force, 
        error: error.message, 
        code: error.code, 
        stack: error.stack?.substring(0, 500) 
      });
      // Re-throw the original error or a more specific AppError
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        SUBSCRIPTION_ERRORS.DELETE_ERROR.code,
        error.message || SUBSCRIPTION_ERRORS.DELETE_ERROR.message,
        error.status || 500,
        { subscriptionId, originalError: error.message }
      );
    }
  }
  
  async getUserSubscriptions(userId, options = {}, context = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        type = null,
        active = null,
        frequency = null,
        search = null,
        from = null,
        to = null,
        status = null // Add support for status parameter
      } = options;
      
      // Log the request parameters for debugging
      console.log('Repository: getUserSubscriptions called with:', { 
        userId, 
        options,
        context: context?.requestId || 'no-context'
      });
      
      // Calculate offset
      const offset = (page - 1) * limit;
      
      // Build the query
      let queryParams = [userId];
      let whereConditions = ['user_id = $1'];
      let paramCounter = 2;
      
      // Add status filter if specified (translating 'active'/'inactive' to boolean)
      if (status && status !== 'all') {
        whereConditions.push(`active = $${paramCounter}`);
        queryParams.push(status === 'active');
        paramCounter++;
      }
      
      // Add type filter if specified
      if (type) {
        // Check if type is a UUID (for direct type_id matching)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(type);
        
        if (isUuid) {
          whereConditions.push(`type_id = $${paramCounter}`);
        } else {
          whereConditions.push(`type_id IN (
            SELECT id FROM subscription_types 
            WHERE LOWER(name) = LOWER($${paramCounter})
          )`);
        }
        
        queryParams.push(type);
        paramCounter++;
      }
      
      // Add active status filter if specified
      if (active !== null && active !== undefined) {
        // Log the active parameter to ensure it's being correctly processed
        console.log('Repository: Applying active filter:', { active, typeof: typeof active });
        whereConditions.push(`active = $${paramCounter}`);
        // Ensure active is boolean regardless of input format
        if (typeof active === 'string') {
          queryParams.push(active.toLowerCase() === 'true');
        } else {
          queryParams.push(!!active);
        }
        paramCounter++;
      }
      
      // Add frequency filter if specified
      if (frequency) {
        whereConditions.push(`frequency = $${paramCounter}`);
        queryParams.push(frequency);
        paramCounter++;
      }
      
      // Add search filter
      if (search) {
        whereConditions.push(`(
          name ILIKE $${paramCounter} OR 
          description ILIKE $${paramCounter} OR
          EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(prompts::jsonb) as p 
            WHERE p ILIKE $${paramCounter}
          )
        )`);
        queryParams.push(`%${search}%`);
        paramCounter++;
      }
      
      // Add date range filters
      if (from) {
        whereConditions.push(`created_at >= $${paramCounter}`);
        queryParams.push(from);
        paramCounter++;
      }
      
      if (to) {
        whereConditions.push(`created_at <= $${paramCounter}`);
        queryParams.push(to);
        paramCounter++;
      }
      
      // Combine where conditions
      const whereClause = whereConditions.join(' AND ');
      
      // Validate and sanitize sort field to prevent SQL injection
      const validSortFields = ['created_at', 'updated_at', 'name', 'frequency', 'active'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      
      // Validate order
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Count total subscriptions for pagination - use complete query with filters
      console.log('Repository: Executing count query with filters');
      const countQuery = `SELECT COUNT(*) as total
         FROM subscriptions 
         WHERE ${whereClause}`;
      
      console.log('Count Query:', countQuery);
      console.log('Count Params:', queryParams);
      
      const countResult = await query(
        countQuery,
        queryParams
      );
      
      if (!countResult || !countResult.rows || countResult.rows.length === 0) {
        console.error('Repository: Count query returned invalid result:', countResult);
        return this._getEmptySubscriptionsResult(options);
      }
      
      const total = parseInt(countResult.rows[0].total || 0);
      const totalPages = Math.ceil(total / limit);
      
      // If there are no real subscriptions but we have stats, generate mock data
      if (total === 0) {
        // Try to get subscription stats to see if we should generate mock data
        try {
          const statsQuery = `SELECT 
                               COUNT(*) as count
                             FROM subscription_stats 
                             WHERE user_id = $1`;
          
          const statsResult = await query(statsQuery, [userId]);
          
          if (statsResult && statsResult.rows && statsResult.rows.length > 0 && parseInt(statsResult.rows[0].count) > 0) {
            // User has stats but no subscriptions - likely a data inconsistency
            console.log('Repository: User has stats but no subscriptions - still returning empty results');
            return this._getEmptySubscriptionsResult(options);
          }
        } catch (statsError) {
          console.error('Repository: Error checking subscription stats:', statsError);
          // Continue with empty result
        }
        
        // No stats either, return empty result
        return {
          subscriptions: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0
          }
        };
      }
      
      // Get paginated subscriptions with all filters
      console.log('Repository: Executing subscriptions query with filters');
      // First check if logo column exists to avoid the error
      let hasLogoColumn = false;
      try {
        const columnCheck = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'subscriptions' AND column_name = 'logo'
        `);
        hasLogoColumn = columnCheck.rows.length > 0;
        console.log('Repository: Logo column exists:', hasLogoColumn);
      } catch (columnError) {
        console.error('Repository: Error checking for logo column:', columnError);
        // Assume logo column doesn't exist
        hasLogoColumn = false;
      }
      
      const mainQuery = `SELECT 
          s.id,
          s.type_id,
          s.name,
          s.description,
          s.prompts,
          ${hasLogoColumn ? 's.logo,' : "'' as logo,"}
          s.frequency,
          s.active,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt"
        FROM subscriptions s 
        WHERE ${whereClause}
        ORDER BY s.${sortField} ${sortOrder}
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      
      // Add pagination parameters
      queryParams.push(limit, offset);
      
      console.log('Main Query:', mainQuery);
      console.log('Main Params:', queryParams);
      
      const result = await query(
        mainQuery,
        queryParams
      );
      
      if (!result || !result.rows || result.rows.length === 0) {
        console.error('Repository: Main query returned empty result:', result);
        return this._getEmptySubscriptionsResult(options);
      }
      
      // Debug log for the query results
      console.log('Repository: Query returned', { 
        rowCount: result.rows.length, 
        filterOptions: options,
        whereClause,
        queryParams: queryParams.map(p => typeof p === 'object' && p instanceof Date ? p.toISOString() : p)
      });
      
      // Process the results
      const subscriptions = result.rows.map(row => {
        // Add default source if we don't have subscription_types join
        const subscriptionWithSource = {
          ...row,
          // Ensure prompts is always an array
          prompts: Array.isArray(row.prompts) ? row.prompts : (row.prompts ? [row.prompts] : []),
          // Add source field based on type_id or default to "BOE" as fallback
          source: "BOE"
        };
        
        return subscriptionWithSource;
      });
      
      // Now fetch the subscription type information separately to avoid join issues
      if (subscriptions.length > 0) {
        try {
          // Get unique type_ids from subscriptions
          const typeIds = [...new Set(subscriptions.map(sub => sub.type_id).filter(id => id))];
          
          if (typeIds.length > 0) {
            const typesQuery = `SELECT id, name as "typeName", icon as "typeIcon" 
                               FROM subscription_types 
                               WHERE id = ANY($1)`;
            
            const typesResult = await query(typesQuery, [typeIds]);
            
            if (typesResult && typesResult.rows) {
              // Create a lookup map
              const typesMap = {};
              typesResult.rows.forEach(type => {
                typesMap[type.id] = type;
              });
              
              // Enhance subscriptions with their type info
              subscriptions.forEach(sub => {
                if (sub.type_id && typesMap[sub.type_id]) {
                  sub.typeName = typesMap[sub.type_id].typeName;
                  sub.typeIcon = typesMap[sub.type_id].typeIcon;
                  // Also set source from the type name
                  sub.source = typesMap[sub.type_id].typeName || "BOE";
                }
              });
            }
          }
        } catch (typeError) {
          console.error('Repository: Error fetching subscription types:', typeError);
          // Continue with basic subscription info - the source is already set to "BOE"
        }
      }
      
      return {
        subscriptions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      };
    } catch (error) {
      console.error('Repository: Error in getUserSubscriptions:', error);
      if (context) {
        logError(context, error);
      }
      
      // Return empty results instead of mock data
      return this._getEmptySubscriptionsResult(options);
    }
  }
  
  // Helper method for empty subscription results (never use mock data)
  _getEmptySubscriptionsResult(options = {}) {
    const { page = 1, limit = 20 } = options;
    
    return {
      subscriptions: [],
      pagination: {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0
      }
    };
  }

  async getSubscriptionById(userId, subscriptionId, context = {}) {
    try {
      console.log('Repository: getSubscriptionById called with:', { userId, subscriptionId });
      
      // First check if subscription exists
      try {
        const existCheck = await query(
          `SELECT EXISTS(
            SELECT 1 FROM subscriptions 
            WHERE id = $1 AND user_id = $2
          ) as exists`,
          [subscriptionId, userId]
        );
        
        // If subscription doesn't exist, return empty result immediately
        if (!existCheck.rows[0].exists) {
          console.log(`Repository: Subscription ${subscriptionId} not found for user ${userId}`);
          return { rows: [] };
        }
      } catch (existError) {
        console.error('Repository: Error checking subscription existence:', existError);
        // Continue with main query anyway
      }
      
      const result = await query(
        `SELECT 
          s.id,
          s.type_id as "typeId",
          s.name,
          s.description,
          s.prompts,
          s.logo,
          s.frequency,
          s.active,
          s.settings,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt",
          t.name as "typeName",
          t.icon as "typeIcon"
        FROM subscriptions s
        LEFT JOIN subscription_types t ON t.id = s.type_id
        WHERE s.id = $1 AND s.user_id = $2`,
        [subscriptionId, userId]
      );
      
      // If we have a result, log it for debugging
      if (result.rows && result.rows.length > 0) {
        console.log('Repository: Found subscription:', {
          id: result.rows[0].id,
          name: result.rows[0].name,
          prompts: result.rows[0].prompts,
          promptsType: typeof result.rows[0].prompts
        });
        
        // Process prompts field to handle different formats
        result.rows.forEach(subscription => {
          try {
            // If prompts is a string that looks like JSON, parse it
            if (typeof subscription.prompts === 'string' && 
                (subscription.prompts.startsWith('[') || subscription.prompts.startsWith('{'))) {
              try {
                subscription.prompts = JSON.parse(subscription.prompts);
              } catch (parseError) {
                console.log('Repository: Could not parse prompts JSON:', parseError);
                // Keep as string if parsing fails
              }
            }
          } catch (promptsError) {
            console.error('Error processing prompts field:', promptsError);
          }
        });
      } else {
        console.log(`Repository: No subscription found with id=${subscriptionId} for user=${userId}`);
      }
      
      return result;
    } catch (error) {
      console.error('Repository: Error in getSubscriptionById:', error);
      if (context) {
        logError(context, error);
      }
      
      // Return empty result instead of throwing to allow service to handle this gracefully
      return { rows: [] };
    }
  }
  
  async getSubscriptionStats(userId, context = {}) {
    try {
      // Get total count
      const totalCountResult = await query(
        `SELECT COUNT(*) as count
         FROM subscriptions
         WHERE user_id = $1`,
        [userId]
      );
      const total = parseInt(totalCountResult.rows[0]?.count || 0);
      
      // If no subscriptions, return early with zeros
      if (total === 0) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          bySource: {},
          byFrequency: {}
        };
      }
      
      // Get active count
      const activeCountResult = await query(
        `SELECT COUNT(*) as count
         FROM subscriptions
         WHERE user_id = $1 AND active = true`,
        [userId]
      );
      const active = parseInt(activeCountResult.rows[0]?.count || 0);
      
      // Get pending (inactive) count
      const pendingCountResult = await query(
        `SELECT COUNT(*) as count
         FROM subscriptions
         WHERE user_id = $1 AND active = false`,
        [userId]
      );
      const inactive = parseInt(pendingCountResult.rows[0]?.count || 0);
      
      // Get subscriptions by source
      const bySourceResult = await query(
        `SELECT 
           COALESCE(t.name, 'Unknown') as source,
           COUNT(*) as count
         FROM subscriptions s
         LEFT JOIN subscription_types t ON s.type_id = t.id
         WHERE s.user_id = $1
         GROUP BY COALESCE(t.name, 'Unknown')
         ORDER BY count DESC`,
        [userId]
      );
      
      const bySource = bySourceResult.rows.reduce((acc, row) => {
        acc[row.source] = parseInt(row.count);
        return acc;
      }, {});
      
      // Get subscriptions by frequency
      const byFrequencyResult = await query(
        `SELECT 
           frequency,
           COUNT(*) as count
         FROM subscriptions
         WHERE user_id = $1
         GROUP BY frequency
         ORDER BY count DESC`,
        [userId]
      );
      
      const byFrequency = byFrequencyResult.rows.reduce((acc, row) => {
        acc[row.frequency] = parseInt(row.count);
        return acc;
      }, {});
      
      return {
        total,
        active,
        inactive,
        bySource,
        byFrequency
      };
    } catch (error) {
      console.error('Repository: Error in getSubscriptionStats:', error);
      if (context) {
        logError(context, error);
      }
      
      // Return a fallback result
      return {
        total: 0,
        active: 0,
        inactive: 0,
        bySource: {},
        byFrequency: {},
        error: error.message
      };
    }
  }
}

export const subscriptionRepository = new SubscriptionRepository();