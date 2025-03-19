import { query } from '../../../infrastructure/database/client.js';

export class SubscriptionRepository {
  async getUserSubscriptions(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      type = null
    } = options;
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build the query
    let queryParams = [userId];
    let queryConditions = 'WHERE s.user_id = $1';
    
    // Add type filter if provided
    if (type) {
      queryParams.push(type);
      queryConditions += ` AND t.type = $${queryParams.length}`;
    }
    
    // Validate and sanitize sort field to prevent SQL injection
    const validSortFields = ['created_at', 'updated_at', 'name', 'frequency', 'active'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    
    // Validate order
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Count total subscriptions for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM subscriptions s
       LEFT JOIN subscription_types t ON s.type_id = t.id
       ${queryConditions}`,
      queryParams
    );
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated subscriptions
    const result = await query(
      `SELECT 
        s.id,
        s.type_id,
        s.name,
        s.description,
        s.prompts,
        s.logo,
        s.frequency,
        s.active,
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        t.name as "typeName",
        t.type as "type",
        t.icon as "typeIcon"
      FROM subscriptions s 
      LEFT JOIN subscription_types t ON s.type_id = t.id
      ${queryConditions}
      ORDER BY s.${sortField} ${sortOrder}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );
    
    return {
      subscriptions: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    };
  }

  async getSubscriptionById(userId, subscriptionId) {
    return await query(
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
  }
  
  async getSubscriptionStats(userId) {
    // Get total count
    const totalCountResult = await query(
      `SELECT COUNT(*) as count
       FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(totalCountResult.rows[0].count);
    
    // Get active count
    const activeCountResult = await query(
      `SELECT COUNT(*) as count
       FROM subscriptions
       WHERE user_id = $1 AND active = true`,
      [userId]
    );
    const active = parseInt(activeCountResult.rows[0].count);
    
    // Get pending (inactive) count
    const pendingCountResult = await query(
      `SELECT COUNT(*) as count
       FROM subscriptions
       WHERE user_id = $1 AND active = false`,
      [userId]
    );
    const pending = parseInt(pendingCountResult.rows[0].count);
    
    // Get subscriptions by source
    const bySourceResult = await query(
      `SELECT 
         t.name as source,
         COUNT(*) as count
       FROM subscriptions s
       JOIN subscription_types t ON s.type_id = t.id
       WHERE s.user_id = $1
       GROUP BY t.name
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
      pending,
      bySource,
      byFrequency
    };
  }
}

export const subscriptionRepository = new SubscriptionRepository();