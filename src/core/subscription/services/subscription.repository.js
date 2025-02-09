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
}

export const subscriptionRepository = new SubscriptionRepository();