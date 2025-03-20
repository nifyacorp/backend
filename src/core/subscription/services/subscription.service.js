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

  async getUserSubscriptions(userId, context, options = {}) {
    logRequest(context, 'Fetching all subscriptions for user', { userId, options });
    
    try {
      const result = await this.repository.getUserSubscriptions(userId, options);
      return result;
    } catch (error) {
      logError(context, error);
      throw new AppError(
        SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
        SUBSCRIPTION_ERRORS.FETCH_ERROR.message,
        500
      );
    }
  }

  async createSubscription(subscriptionData, context) {
    logRequest(context, 'Creating new subscription', subscriptionData);
    
    // Validate data
    if (!subscriptionData.name) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
        'Subscription name is required',
        400
      );
    }
    
    if (!subscriptionData.type) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
        'Subscription type is required',
        400
      );
    }
    
    if (!subscriptionData.userId) {
      throw new AppError(
        SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
        'User ID is required',
        400
      );
    }

    try {
      // Get type_id from type name or use provided typeId directly
      let type_id;
      
      // First try to use typeId directly if provided
      if (subscriptionData.typeId) {
        try {
          // Check if typeId is a valid UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          
          if (uuidRegex.test(subscriptionData.typeId)) {
            // If typeId is directly provided, check if it exists in subscription_types
            const typeIdCheck = await query(
              'SELECT id FROM subscription_types WHERE id = $1',
              [subscriptionData.typeId]
            );
            
            if (typeIdCheck.rows.length > 0) {
              type_id = typeIdCheck.rows[0].id;
              logRequest(context, 'Using provided typeId', { typeId: type_id });
            } else {
              // If not found in subscription_types, check subscription_templates
              const templateCheck = await query(
                'SELECT id FROM subscription_templates WHERE id = $1',
                [subscriptionData.typeId]
              );
              
              if (templateCheck.rows.length > 0) {
                // For a template ID, we need to find the corresponding type_id
                const templateTypeCheck = await query(
                  `SELECT st.id 
                   FROM subscription_types st 
                   JOIN subscription_templates t ON LOWER(st.name) = LOWER(t.type) 
                   WHERE t.id = $1`,
                  [subscriptionData.typeId]
                );
                
                if (templateTypeCheck.rows.length > 0) {
                  type_id = templateTypeCheck.rows[0].id;
                  logRequest(context, 'Resolved type_id from template', { 
                    templateId: subscriptionData.typeId, 
                    type_id 
                  });
                } else {
                  // If type not found by template, use a default mapping
                  const defaultTypeMap = {
                    'boe': 'BOE',
                    'real-estate': 'Inmobiliaria',
                    'doga': 'DOGA'
                  };
                  
                  // Get template type
                  const templateData = await query(
                    'SELECT type FROM subscription_templates WHERE id = $1',
                    [subscriptionData.typeId]
                  );
                  
                  if (templateData.rows.length > 0) {
                    const templateType = templateData.rows[0].type;
                    const mappedType = defaultTypeMap[templateType.toLowerCase()] || 'Custom';
                    
                    // Get type_id by name
                    const typeByNameCheck = await query(
                      'SELECT id FROM subscription_types WHERE name = $1',
                      [mappedType]
                    );
                    
                    if (typeByNameCheck.rows.length > 0) {
                      type_id = typeByNameCheck.rows[0].id;
                      logRequest(context, 'Used default type mapping for template', { 
                        templateId: subscriptionData.typeId,
                        templateType,
                        mappedType,
                        type_id 
                      });
                    }
                  }
                }
              }
            }
          } else {
            logRequest(context, 'Invalid UUID format for typeId', { typeId: subscriptionData.typeId });
          }
        } catch (error) {
          logError(context, error, 'Error checking typeId');
        }
      }
      
      // If typeId wasn't resolved, try to get from type name
      if (!type_id && subscriptionData.type) {
        try {
          logRequest(context, 'Attempting to resolve type_id from type name', { type: subscriptionData.type });
          
          // First check if the type matches a subscription_type name
          let typeCheckResult = await query(
            'SELECT id FROM subscription_types WHERE LOWER(name) = LOWER($1)',
            [subscriptionData.type]
          );
          
          // If not found by name, try to match any field that might contain the type
          if (typeCheckResult.rows.length === 0) {
            // Try several variations and fields
            const variations = [
              subscriptionData.type.toLowerCase(),
              subscriptionData.type.toUpperCase(),
              subscriptionData.type
            ];
            
            for (const variation of variations) {
              typeCheckResult = await query(
                `SELECT id FROM subscription_types 
                WHERE LOWER(name) = LOWER($1) 
                OR LOWER(description) LIKE LOWER($2)`,
                [variation, `%${variation}%`]
              );
              
              if (typeCheckResult.rows.length > 0) {
                break;
              }
            }
          }
          
          if (typeCheckResult.rows.length > 0) {
            type_id = typeCheckResult.rows[0].id;
            logRequest(context, 'Resolved type_id from type name', { 
              type: subscriptionData.type, 
              type_id 
            });
          }
        } catch (error) {
          logError(context, error, 'Error resolving type name');
        }
      }
      
      // If still no type_id, create a fallback using the default types
      if (!type_id) {
        try {
          // Map common type strings to known system types
          const defaultTypeMap = {
            'boe': 'BOE',
            'real-estate': 'Inmobiliaria',
            'inmobiliaria': 'Inmobiliaria',
            'real estate': 'Inmobiliaria',
            'doga': 'DOGA'
          };
          
          const typeToLookup = subscriptionData.type ? 
            defaultTypeMap[subscriptionData.type.toLowerCase()] || 'BOE' : 'BOE';
          
          const fallbackCheck = await query(
            'SELECT id FROM subscription_types WHERE name = $1',
            [typeToLookup]
          );
          
          if (fallbackCheck.rows.length > 0) {
            type_id = fallbackCheck.rows[0].id;
            logRequest(context, 'Using fallback type', { 
              originalType: subscriptionData.type,
              fallbackType: typeToLookup,
              type_id 
            });
          } else {
            // Last resort: get the first system type
            const systemTypeCheck = await query(
              'SELECT id FROM subscription_types WHERE is_system = true LIMIT 1'
            );
            
            if (systemTypeCheck.rows.length > 0) {
              type_id = systemTypeCheck.rows[0].id;
              logRequest(context, 'Using first system type as fallback', { type_id });
            }
          }
        } catch (error) {
          logError(context, error, 'Error using fallback type');
        }
      }
      
      // If no type_id could be resolved, throw error
      if (!type_id) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.VALIDATION_ERROR.code,
          `Invalid subscription type: ${subscriptionData.type || subscriptionData.typeId}. Please select a valid subscription type.`,
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
      
      // Map frontend frequency to backend format
      const frequencyMap = {
        'immediate': 'immediate',
        'daily': 'daily',
        'Instant': 'immediate',
        'Daily': 'daily',
        'Weekly': 'daily' // Map weekly to daily as fallback until weekly is supported
      };
      
      // Format the subscription data correctly for the database
      const subscription = {
        ...defaults,
        name: subscriptionData.name,
        description: subscriptionData.description || '',
        type_id: type_id,
        prompts: subscriptionData.prompts || [],
        frequency: frequencyMap[subscriptionData.frequency] || 'daily',
        logo: subscriptionData.logo || null,
        user_id: subscriptionData.userId,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      logRequest(context, 'Formatted subscription data for database', { subscription });
      
      const fields = Object.keys(subscription);
      const values = Object.values(subscription);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const result = await query(
        `INSERT INTO subscriptions (${fields.join(', ')}) 
         VALUES (${placeholders})
         RETURNING id, name, description, type_id, prompts, frequency, logo, active, created_at, updated_at`,
        values
      );
      
      // Get the subscription type for the response
      const typeResult = await query(
        `SELECT type, name FROM subscription_types WHERE id = $1`,
        [type_id]
      );
      
      const subscriptionType = typeResult.rows[0] || { type: 'unknown', name: 'Unknown Type' };
      
      // Format the subscription object for the response
      const newSubscription = {
        ...result.rows[0],
        type: subscriptionType.type,
        typeName: subscriptionType.name
      };
      
      // Publish an event for the subscription creation
      try {
        logPubSub(context, 'Publishing subscription.created event', { 
          subscriptionId: newSubscription.id 
        });
        
        await publishEvent('subscription.created', {
          subscription_id: newSubscription.id,
          user_id: subscriptionData.userId,
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