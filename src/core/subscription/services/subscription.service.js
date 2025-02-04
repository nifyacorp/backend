import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';
import { logRequest, logError, logPubSub, logProcessing } from '../../../shared/logging/logger.js';
import { publishEvent } from '../../../infrastructure/pubsub/client.js';

class SubscriptionService {
  async getUserSubscriptions(userId, context) {
    logRequest(context, 'Fetching user subscriptions', { userId });

    try {
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
          s.updated_at as "updatedAt"
        FROM subscriptions s 
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
          logo,
          frequency,
          active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          id,
          name,
          description,
          prompts,
          logo,
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
          data.logo,
          data.frequency,
          true
        ]
      );

      // Create processing record
      const processingResult = await query(
        `INSERT INTO subscription_processing (
          subscription_id,
          status,
          next_run_at,
          metadata
        ) VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [
          result.rows[0].id,
          'pending',
          new Date(), // Start processing immediately
          JSON.stringify({
            type: data.typeId,
            frequency: data.frequency,
            prompts: data.prompts
          })
        ]
      );

      logProcessing(context, 'Processing record created', {
        subscriptionId: result.rows[0].id,
        processingId: processingResult.rows[0].id
      });

      // Publish subscription created event
      await publishEvent('subscription-events', {
        type: 'subscription-created',
        data: {
          userId,
          subscriptionId: result.rows[0].id,
          prompts: data.prompts,
          frequency: data.frequency
        }
      });

      logPubSub(context, 'Subscription created event published', {
        userId,
        subscriptionId: result.rows[0].id
      });

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

  async updateSubscription(userId, subscriptionId, data, context) {
    logRequest(context, 'Updating subscription', { userId, subscriptionId });

    try {
      if (data.prompts && data.prompts.length > 3) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.INVALID_PROMPTS.code,
          SUBSCRIPTION_ERRORS.INVALID_PROMPTS.message,
          400
        );
      }

      const result = await query(
        `UPDATE subscriptions
        SET
          name = COALESCE($3, name),
          description = COALESCE($4, description),
          prompts = COALESCE($5, prompts),
          logo = COALESCE($6, logo),
          frequency = COALESCE($7, frequency),
          active = COALESCE($8, active),
          updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING 
          id,
          type_id,
          name,
          description,
          prompts,
          logo,
          frequency,
          active,
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [
          subscriptionId,
          userId,
          data.name || null,
          data.description || null,
          data.prompts || null,
          data.logo || null,
          data.frequency || null,
          data.active === undefined ? null : data.active
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
        'Failed to update subscription',
        500
      );
    }
  }

  async deleteSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Deleting subscription', { userId, subscriptionId });

    let client;
    try {
      // Get a client for transaction
      client = await pool.connect();
      
      // Start transaction
      await client.query('BEGIN');
      
      // Delete processing record first (foreign key will prevent orphaned records)
      const processingResult = await client.query(
        `DELETE FROM subscription_processing 
         WHERE subscription_id = $1
         RETURNING id`,
        [subscriptionId]
      );
      
      logProcessing(context, 'Processing record deleted', {
        subscriptionId,
        processingId: processingResult.rows[0]?.id
      });
      
      // Then delete the subscription
      const result = await client.query(
        `DELETE FROM subscriptions 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [subscriptionId, userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      // Commit transaction
      await client.query('COMMIT');

      return { success: true };
    } catch (error) {
      // Rollback on error
      if (client) await client.query('ROLLBACK');
      
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        SUBSCRIPTION_ERRORS.DELETE_ERROR.code,
        'Failed to delete subscription',
        500
      );
    } finally {
      if (client) client.release();
    }
  }
}

export const subscriptionService = new SubscriptionService();