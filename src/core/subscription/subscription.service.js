import { query } from '../../infrastructure/database/client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

class SubscriptionService {
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

  async getUserSubscriptions(userId, context) {
    logRequest(context, 'Fetching user subscriptions', { userId });

    try {
      const result = await query(
        `SELECT 
          s.id,
          s.name,
          s.description,
          s.prompts,
          s.frequency,
          s.active,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt",
          t.id as "typeId",
          t.name as "typeName",
          t.description as "typeDescription",
          t.icon as "typeIcon",
          t.is_system as "typeIsSystem"
        FROM subscriptions s
        JOIN subscription_types t ON s.type_id = t.id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC`,
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

  async createSubscription(userId, data, context) {
    logRequest(context, 'Creating subscription', { userId });

    try {
      // Validate prompts length
      if (data.prompts.length > 3) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.INVALID_PROMPTS.code,
          SUBSCRIPTION_ERRORS.INVALID_PROMPTS.message,
          400
        );
      }

      const result = await query(
        `INSERT INTO subscriptions (
          user_id,
          type_id,
          name,
          description,
          prompts,
          frequency,
          active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          id,
          name,
          description,
          prompts,
          frequency,
          active,
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [
          userId,
          data.typeId,
          data.name,
          data.description,
          data.prompts,
          data.frequency,
          true
        ]
      );

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        SUBSCRIPTION_ERRORS.CREATE_ERROR.code,
        SUBSCRIPTION_ERRORS.CREATE_ERROR.message,
        500
      );
    }
  }
}

export const subscriptionService = new SubscriptionService();