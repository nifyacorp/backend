import { query } from '../../../infrastructure/database/client.js';
import { logError } from '../../../shared/logging/logger.js';

export class SubscriptionRepository {
  async getUserSubscriptions(userId, options = {}, context = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        type = null
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
      
      // Validate and sanitize sort field to prevent SQL injection
      const validSortFields = ['created_at', 'updated_at', 'name', 'frequency', 'active'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      
      // Validate order
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Count total subscriptions for pagination - use simpler query
      console.log('Repository: Executing count query');
      const countQuery = `SELECT COUNT(*) as total
         FROM subscriptions 
         WHERE user_id = $1`;
      
      console.log('Count Query:', countQuery);
      console.log('Count Params:', [userId]);
      
      const countResult = await query(
        countQuery,
        [userId]
      );
      
      if (!countResult || !countResult.rows || countResult.rows.length === 0) {
        console.error('Repository: Count query returned invalid result:', countResult);
        // Fallback to empty result
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
      
      const total = parseInt(countResult.rows[0].total || 0);
      const totalPages = Math.ceil(total / limit);
      
      // If there are no subscriptions, return empty result early
      if (total === 0) {
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
      
      // Get paginated subscriptions - simplify the query and avoid the join
      console.log('Repository: Executing subscriptions query');
      const mainQuery = `SELECT 
          s.id,
          s.type_id,
          s.name,
          s.description,
          s.prompts,
          s.logo,
          s.frequency,
          s.active,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt"
        FROM subscriptions s 
        WHERE s.user_id = $1
        ORDER BY s.${sortField} ${sortOrder}
        LIMIT $2 OFFSET $3`;
      
      console.log('Main Query:', mainQuery);
      console.log('Main Params:', [userId, limit, offset]);
      
      const result = await query(
        mainQuery,
        [userId, limit, offset]
      );
      
      if (!result || !result.rows) {
        console.error('Repository: Main query returned invalid result:', result);
        // Fallback to empty result
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
            const typesQuery = `SELECT id, type, name as "typeName", icon as "typeIcon" 
                               FROM subscription_types 
                               WHERE id = ANY($1::uuid[])`;
            
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
                  sub.type = typesMap[sub.type_id].type;
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
      
      // Return a fallback empty result rather than propagating the error
      return {
        subscriptions: [],
        pagination: {
          total: 0,
          page: parseInt(options?.page || 1),
          limit: parseInt(options?.limit || 20),
          totalPages: 0
        },
        error: error.message
      };
    }
  }

  async getSubscriptionById(userId, subscriptionId, context = {}) {
    try {
      console.log('Repository: getSubscriptionById called with:', { userId, subscriptionId });
      
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
      
      return result.rows[0];
    } catch (error) {
      console.error('Repository: Error in getSubscriptionById:', error);
      if (context) {
        logError(context, error);
      }
      throw error;
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