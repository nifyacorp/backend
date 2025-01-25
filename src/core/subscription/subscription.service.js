import { query } from '../../infrastructure/database/client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

class SubscriptionService {
  async getUserSubscriptions(userId, context) {
    logRequest(context, 'Fetching user subscriptions', { userId });

    try {
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

      logRequest(context, 'Subscriptions retrieved', {
        userId,
        count: result.rows.length
      });

      return result.rows;
    } catch (error) {
      logError(context, error, { userId });
      throw new AppError(
        'SUBSCRIPTION_FETCH_ERROR',
        'Failed to fetch subscriptions',
        500,
        { userId }
      );
    }
  }
}

export const subscriptionService = new SubscriptionService();