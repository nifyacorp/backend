import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';
import { logRequest, logError, logPubSub, logProcessing } from '../../../shared/logging/logger.js';
import { publishEvent } from '../../../infrastructure/pubsub/client.js';
import { subscriptionRepository } from './subscription.repository.js';

class SubscriptionService {
  constructor(repository) {
    this.repository = repository;
  }
  
  async getSubscriptionStats(userId, context) {
    logRequest(context, 'Fetching subscription statistics', { userId });
    
    try {
      return await this.repository.getSubscriptionStats(userId);
    } catch (error) {
      logError(context, error);
      throw new AppError(
        SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
        'Failed to fetch subscription statistics',
        500
      );
    }
  }

  async getSubscriptionById(userId, subscriptionId, context) {
    logRequest(context, 'Fetching subscription by ID', { userId, subscriptionId });

    try {
      const result = await this.repository.getSubscriptionById(userId, subscriptionId);

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

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
        SUBSCRIPTION_ERRORS.FETCH_ERROR.message,
        500
      );
    }
  }

  async getUserSubscriptions(userId, context) {
    logRequest(context, 'Fetching all subscriptions for user', { userId });
    
    try {
      const result = await this.repository.getUserSubscriptions(userId);
      return result.rows;
    } catch (error) {
      logError(context, error);
      throw new AppError(
        SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
        SUBSCRIPTION_ERRORS.FETCH_ERROR.message,
        500
      );
    }
  }

  async createSubscription(userId, subscriptionData, context) {
    logRequest(context, 'Creating new subscription', { userId, subscriptionData });
    
    // Validate data
    if (!subscriptionData.name) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
        'Subscription name is required',
        400
      );
    }
    
    if (!subscriptionData.type_id) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
        'Subscription type is required',
        400
      );
    }

    try {
      // Check if the type_id is valid
      const typeCheckResult = await query(
        'SELECT id FROM subscription_types WHERE id = $1',
        [subscriptionData.type_id]
      );
      
      if (typeCheckResult.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
          'Invalid subscription type',
          400
        );
      }
      
      // Set default values if not provided
      const defaults = {
        description: '',
        prompts: [], 
        frequency: 'daily',
        active: true
      };
      
      const subscription = {
        ...defaults,
        ...subscriptionData,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const fields = Object.keys(subscription);
      const values = Object.values(subscription);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const result = await query(
        `INSERT INTO subscriptions (${fields.join(', ')}) 
         VALUES (${placeholders})
         RETURNING id, name, description, type_id, frequency, active, created_at`,
        values
      );
      
      const newSubscription = result.rows[0];
      
      // Publish an event for the subscription creation
      try {
        logPubSub(context, 'Publishing subscription.created event', { 
          subscriptionId: newSubscription.id 
        });
        
        await publishEvent('subscription.created', {
          subscription_id: newSubscription.id,
          user_id: userId,
          timestamp: new Date().toISOString()
        });
      } catch (pubsubError) {
        // Log the error but don't fail the subscription creation
        logError(context, pubsubError, 'Failed to publish subscription.created event');
      }
      
      return newSubscription;
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.CREATE_ERROR.code,
        SUBSCRIPTION_ERRORS.CREATE_ERROR.message,
        500
      );
    }
  }

  async updateSubscription(userId, subscriptionId, updateData, context) {
    logRequest(context, 'Updating subscription', { userId, subscriptionId, updateData });
    
    try {
      // First, check if the subscription exists and belongs to the user
      const checkResult = await query(
        'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      // Add updated_at field
      const dataToUpdate = {
        ...updateData,
        updated_at: new Date()
      };
      
      // Create SQL SET part
      const fields = Object.keys(dataToUpdate);
      if (fields.length === 0) {
        return { message: 'No changes to update' };
      }
      
      const setClause = fields.map((field, i) => `${field} = $${i + 3}`).join(', ');
      const values = Object.values(dataToUpdate);
      
      const result = await query(
        `UPDATE subscriptions 
         SET ${setClause} 
         WHERE id = $1 AND user_id = $2 
         RETURNING id, name, description, type_id, frequency, active, updated_at`,
        [subscriptionId, userId, ...values]
      );
      
      // Publish an event for the subscription update
      try {
        logPubSub(context, 'Publishing subscription.updated event', { 
          subscriptionId 
        });
        
        await publishEvent('subscription.updated', {
          subscription_id: subscriptionId,
          user_id: userId,
          updates: Object.keys(updateData),
          timestamp: new Date().toISOString()
        });
      } catch (pubsubError) {
        // Log the error but don't fail the update operation
        logError(context, pubsubError, 'Failed to publish subscription.updated event');
      }
      
      return result.rows[0];
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.message,
        500
      );
    }
  }

  async processSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Processing subscription', { userId, subscriptionId });
    
    try {
      // First, check if the subscription exists and belongs to the user
      const result = await query(
        `SELECT s.id, s.name, s.type_id, t.name as type_name
         FROM subscriptions s
         JOIN subscription_types t ON s.type_id = t.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [subscriptionId, userId]
      );
      
      if (result.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      const subscription = result.rows[0];
      
      // Log that we're about to initiate processing
      logProcessing(context, 'Initiating subscription processing', {
        subscriptionId,
        type: subscription.type_name
      });
      
      // Record processing request in the database
      const processingResult = await query(
        `INSERT INTO subscription_processing
         (subscription_id, status, requested_at, user_id)
         VALUES ($1, 'pending', NOW(), $2)
         RETURNING id`,
        [subscriptionId, userId]
      );
      
      const processingId = processingResult.rows[0].id;
      
      // Publish event to trigger processing
      try {
        logPubSub(context, 'Publishing subscription.process event', { 
          subscriptionId,
          processingId 
        });
        
        await publishEvent('subscription.process', {
          subscription_id: subscriptionId,
          processing_id: processingId,
          user_id: userId,
          type: subscription.type_id,
          type_name: subscription.type_name,
          timestamp: new Date().toISOString()
        });
        
        return {
          message: 'Subscription processing initiated',
          processingId,
          subscriptionId
        };
      } catch (pubsubError) {
        logError(context, pubsubError, 'Failed to publish subscription.process event');
        
        // Mark processing as failed
        await query(
          `UPDATE subscription_processing
           SET status = 'failed', 
               completed_at = NOW(),
               error = $1
           WHERE id = $2`,
          ['Failed to publish processing event', processingId]
        );
        
        throw new AppError(
          SUBSCRIPTION_ERRORS.PROCESSING_ERROR.code,
          'Failed to initiate subscription processing',
          500
        );
      }
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.PROCESSING_ERROR.code,
        SUBSCRIPTION_ERRORS.PROCESSING_ERROR.message,
        500
      );
    }
  }

  async deleteSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Deleting subscription', { userId, subscriptionId });
    
    try {
      // First, check if the subscription exists and belongs to the user
      const checkResult = await query(
        'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      // Delete the subscription
      await query(
        'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
        [subscriptionId, userId]
      );
      
      // Publish an event for the subscription deletion
      try {
        logPubSub(context, 'Publishing subscription.deleted event', { 
          subscriptionId 
        });
        
        await publishEvent('subscription.deleted', {
          subscription_id: subscriptionId,
          user_id: userId,
          timestamp: new Date().toISOString()
        });
      } catch (pubsubError) {
        // Log the error but don't fail the deletion operation
        logError(context, pubsubError, 'Failed to publish subscription.deleted event');
      }
      
      return { 
        message: 'Subscription deleted successfully',
        id: subscriptionId
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.DELETE_ERROR.code,
        'Failed to delete subscription',
        500
      );
    }
  }
}

export const subscriptionService = new SubscriptionService(subscriptionRepository);