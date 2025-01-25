import { query } from '../config/database.js';

class SubscriptionService {
  async getUserSubscriptions(userId) {
    console.log('🔍 Fetching subscriptions:', {
      userId,
      timestamp: new Date().toISOString()
    });

    const result = await query(
      `SELECT 
        id,
        type,
        name,
        description,
        prompts,
        frequency,
        status = 'active' as active,
        created_at,
        updated_at
      FROM subscriptions 
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [userId]
    );

    console.log('✅ Subscriptions retrieved:', {
      userId,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  }
}

export const subscriptionService = new SubscriptionService();