import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

class TypeService {
  // Add a getTypes method that calls getSubscriptionTypes for backwards compatibility
  async getTypes(userId, context) {
    logRequest(context, 'Fetching subscription types (via getTypes)', { userId });
    return this.getSubscriptionTypes(context);
  }

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

  // Add a wrapper method to match the method name used in the routes
  async createType(data, context) {
    logRequest(context, 'Creating subscription type (via createType)', { 
      createdBy: data.createdBy,
      name: data.name
    });
    return this.createSubscriptionType(data.createdBy, data, context);
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