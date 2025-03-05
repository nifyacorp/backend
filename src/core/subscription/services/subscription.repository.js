import { query } from '../../../infrastructure/database/client.js';

export class SubscriptionRepository {
  async getUserSubscriptions(userId) {
    return await query(
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
        s.updated_at as "updatedAt"
      FROM subscriptions s 
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC`,
      [userId]
    );
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