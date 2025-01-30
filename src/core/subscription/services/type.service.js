import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

class TypeService {
  async getSubscriptionTypes(context) {
    logRequest(context, 'Fetching subscription types');

    try {
      const result = await query(
        `SELECT 
          id,
          name,
          description,
          icon,
          is_system as "isSystem",
          created_by as "createdBy",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM subscription_types
        ORDER BY is_system DESC, name ASC`,
        []
      );

      logRequest(context, 'Subscription types retrieved', {
        count: result.rows.length
      });

      return result.rows;
    } catch (error) {
      logError(context, error);
      throw new AppError(
        'TYPE_FETCH_ERROR',
        'Failed to fetch subscription types',
        500
      );
    }
  }

  async createSubscriptionType(userId, data, context) {
    logRequest(context, 'Creating subscription type', { userId });

    try {
      const result = await query(
        `INSERT INTO subscription_types (
          name,
          description,
          icon,
          created_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING 
          id,
          name,
          description,
          icon,
          is_system as "isSystem",
          created_by as "createdBy",
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [data.name, data.description, data.icon, userId]
      );

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      throw new AppError(
        'TYPE_CREATE_ERROR',
        'Failed to create subscription type',
        500
      );
    }
  }
}

export const typeService = new TypeService();