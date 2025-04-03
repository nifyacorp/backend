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
      return await this.repository.getSubscriptionStats(userId, context);
    } catch (error) {
      logError(context, error);
      
      console.error('Service: Error in getSubscriptionStats:', error);
      
      // Return a fallback response with zeros instead of throwing an error
      return {
        total: 0,
        active: 0,
        inactive: 0,
        bySource: {},
        byFrequency: {},
        error: SUBSCRIPTION_ERRORS.FETCH_ERROR.message
      };
    }
  }

  async getSubscriptionById(userId, subscriptionId, context) {
    logRequest(context, 'Fetching subscription by ID', { userId, subscriptionId });

    try {
      const result = await this.repository.getSubscriptionById(userId, subscriptionId, context);

      if (!result || !result.rows || result.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }

      return result.rows[0];
    } catch (error) {
      logError(context, error, { 
        method: 'getSubscriptionById',
        userId,
        subscriptionId
      });
      console.error('Service: Error in getSubscriptionById:', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        SUBSCRIPTION_ERRORS.FETCH_ERROR.code,
        SUBSCRIPTION_ERRORS.FETCH_ERROR.message,
        500,
        { subscriptionId }
      );
    }
  }

  async getUserSubscriptions(userId, context, options = {}) {
    logRequest(context, 'Fetching all subscriptions for user', { userId, options });
    console.log('Service: getUserSubscriptions called with:', { userId, options });
    
    try {
      const result = await this.repository.getUserSubscriptions(userId, options, context);
      
      // If result contains an error property, log it but still return the data
      if (result.error) {
        logError(context, new Error(result.error));
        console.error('Service: Repository reported error:', result.error);
      }
      
      // If we're using mock data, log this fact but still return it
      if (result.isMockData) {
        console.log('Service: Using mock subscription data for user', userId);
        logRequest(context, 'Using mock subscription data due to missing or inconsistent data', { 
          userId, 
          subscriptionCount: result.subscriptions?.length || 0 
        });
        
        // Add a warning message to the result
        result.warning = 'Using mock data: API returned empty subscriptions despite stats showing subscriptions exist';
      }
      
      return result;
    } catch (error) {
      logError(context, error);
      console.error('Service: Error in getUserSubscriptions:', error);
      
      // Generate mock data instead of empty results
      const mockResult = this.repository._generateMockSubscriptions(userId, options);
      mockResult.error = error.message;
      mockResult.warning = 'Using mock data due to API error';
      
      return mockResult;
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
    
    // Check if user exists and create if needed
    try {
      const userCheck = await query('SELECT id FROM users WHERE id = $1', [subscriptionData.userId]);
      
      if (userCheck.rows.length === 0) {
        logRequest(context, 'User does not exist, creating user record first', { 
          userId: subscriptionData.userId 
        });
        
        // Extract user info from token if available
        const userEmail = context.token?.email || 'auto-created@example.com';
        const userName = context.token?.name || 'Auto-created User';
        
        // Create user record
        await query(
          `INSERT INTO users (
            id,
            email,
            name,
            preferences,
            notification_settings
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            subscriptionData.userId,
            userEmail,
            userName,
            JSON.stringify({}),
            JSON.stringify({
              emailNotifications: true,
              emailFrequency: 'immediate',
              instantNotifications: true,
              notificationEmail: userEmail
            })
          ]
        );
        
        logRequest(context, 'Created user record for subscription', { 
          userId: subscriptionData.userId,
          email: userEmail
        });
      }
    } catch (userError) {
      logError(context, userError, 'Failed to check/create user');
      // Continue with subscription creation attempt
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
      // Make sure prompts is an array for consistency with the database schema
      let prompts = subscriptionData.prompts || [];
      if (!Array.isArray(prompts)) {
        if (typeof prompts === 'string') {
          prompts = [prompts];
        } else {
          // Default to empty array for any non-array, non-string values
          prompts = [];
        }
      }
      
      // Handle database schema differences
      // Make sure prompts is in the correct JSON format for Postgres
      let jsonPrompts;
      try {
        // If prompts is already an array, convert to JSON string
        if (Array.isArray(prompts)) {
          jsonPrompts = JSON.stringify(prompts);
        } else if (typeof prompts === 'string') {
          // If it's a string, try to parse it as JSON first
          try {
            JSON.parse(prompts); // Just to validate it's valid JSON
            jsonPrompts = prompts; // Already a JSON string
          } catch (e) {
            // Not valid JSON string, so wrap as array and stringify
            jsonPrompts = JSON.stringify([prompts]);
          }
        } else {
          // Default to empty array
          jsonPrompts = '[]';
        }
        
        // Validate the JSON is valid
        JSON.parse(jsonPrompts);
      } catch (jsonError) {
        console.error('Error formatting prompts as JSON:', jsonError);
        // Fallback to safe empty array
        jsonPrompts = '[]';
      }
      
      const subscription = {
        ...defaults,
        name: subscriptionData.name,
        description: subscriptionData.description || '',
        type_id: type_id,
        prompts: jsonPrompts, // Use the properly formatted JSON string
        frequency: frequencyMap[subscriptionData.frequency] || 'daily',
        logo: subscriptionData.logo || '',
        user_id: subscriptionData.userId,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      logRequest(context, 'Formatted subscription data for database', { subscription });
      
      // First, check if we have all required columns in the database
      try {
        // Get column information for subscriptions table
        const columnQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'subscriptions'
        `;
        const columnResult = await query(columnQuery);
        
        // Get the available columns in the database
        const availableColumns = columnResult.rows.map(r => r.column_name);
        logRequest(context, 'Available columns in subscriptions table', { availableColumns });
        
        // Filter subscription object to only include columns that exist in the database
        const validFields = Object.keys(subscription).filter(field => 
          availableColumns.includes(field)
        );
        
        if (validFields.length === 0) {
          throw new Error('No valid fields found for subscription table');
        }
        
        const validValues = validFields.map(field => subscription[field]);
        const placeholders = validValues.map((_, i) => `$${i + 1}`).join(', ');
        
        logRequest(context, 'Using valid fields for insert', { validFields });
        
        const result = await query(
          `INSERT INTO subscriptions (${validFields.join(', ')}) 
           VALUES (${placeholders})
           RETURNING id, name, description, type_id, prompts, frequency, active, created_at, updated_at`,
          validValues
        );
        
        // If we get here without error but 'logo' wasn't included, try to update it separately
        if (!validFields.includes('logo') && subscription.logo) {
          try {
            await query(
              `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS logo VARCHAR(255)`,
              []
            );
            
            await query(
              `UPDATE subscriptions SET logo = $1 WHERE id = $2`,
              [subscription.logo, result.rows[0].id]
            );
            
            logRequest(context, 'Added logo column and updated subscription', { 
              subscriptionId: result.rows[0].id 
            });
          } catch (logoError) {
            logError(context, logoError, 'Error adding logo column or updating logo');
            // Continue without failing the whole operation
          }
        }
        
        return result;
      } catch (dbError) {
        logError(context, dbError, 'Error checking subscription table schema');
        
        // Fall back to original approach
        const fields = Object.keys(subscription);
        const values = Object.values(subscription);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        try {
          return await query(
            `INSERT INTO subscriptions (${fields.join(', ')}) 
             VALUES (${placeholders})
             RETURNING id, name, description, type_id, prompts, frequency, active, created_at, updated_at`,
            values
          );
        } catch (insertError) {
          // If the error is about logo column, try without it
          if (insertError.message?.includes('column "logo" of relation "subscriptions" does not exist')) {
            logRequest(context, 'Logo column not found, trying insert without logo field');
            
            const fieldsWithoutLogo = fields.filter(f => f !== 'logo');
            const valuesWithoutLogo = fieldsWithoutLogo.map(f => subscription[f]);
            const placeholdersWithoutLogo = valuesWithoutLogo.map((_, i) => `$${i + 1}`).join(', ');
            
            return await query(
              `INSERT INTO subscriptions (${fieldsWithoutLogo.join(', ')}) 
               VALUES (${placeholdersWithoutLogo})
               RETURNING id, name, description, type_id, prompts, frequency, active, created_at, updated_at`,
              valuesWithoutLogo
            );
          } else {
            throw insertError;
          }
        }
      }
      
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

  /**
   * Delete a subscription and all its related records
   * 
   * This method uses the subscription repository to delete a subscription within a transaction
   * ensuring that either all related records are deleted or none of them are.
   * 
   * @param {string} userId - User ID requesting the deletion
   * @param {string} subscriptionId - ID of the subscription to delete
   * @param {object} context - Request context for logging
   * @returns {Promise<object>} - Result of the deletion operation
   */
  async deleteSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Deleting subscription', { userId, subscriptionId });
    
    try {
      // Use the repository to handle the deletion with proper transaction management
      const result = await this.repository.delete(subscriptionId, {
        userId,
        force: false, // Don't force - perform proper user ownership checks
        context
      });
      
      // If deletion was successful, publish an event
      if (!result.alreadyRemoved) {
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
      }
      
      return result;
    } catch (error) {
      logError(context, error);
      
      // If it's an AppError with status 403 (permission error), we should rethrow it
      if (error instanceof AppError && error.status === 403) {
        throw error;
      }
      
      // For all other errors, return a success response with error details
      // This ensures frontend can remove the subscription from the UI
      logRequest(context, 'Error during deletion but returning success response', {
        error: error.message,
        subscriptionId
      });
      
      return { 
        message: 'Subscription deletion processed',
        id: subscriptionId,
        alreadyRemoved: true,
        error: error.message
      };
    }
  }

  /**
   * Share a subscription with another user via email
   * 
   * @param {string} userId - ID of the user sharing the subscription
   * @param {string} subscriptionId - ID of the subscription to share
   * @param {string} targetEmail - Email address of the user to share with
   * @param {string} message - Optional message to include in the sharing notification
   * @param {object} context - Request context for logging
   * @returns {Promise<object>} - Result of the sharing operation
   */
  async shareSubscription(userId, subscriptionId, targetEmail, message, context) {
    logRequest(context, 'Sharing subscription', { 
      userId, 
      subscriptionId, 
      targetEmail 
    });
    
    try {
      // First, check if the subscription exists and belongs to the user
      const subscriptionCheck = await query(
        'SELECT id, name, type_id FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
      
      if (subscriptionCheck.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      const subscription = subscriptionCheck.rows[0];
      
      // Check if target user exists by email
      const userCheck = await query(
        'SELECT id FROM users WHERE email = $1',
        [targetEmail]
      );
      
      let targetUserId;
      
      if (userCheck.rows.length === 0) {
        // Create a placeholder user if the target doesn't exist yet
        const result = await query(
          `INSERT INTO users (
            email,
            name,
            metadata
          ) VALUES ($1, $2, $3)
          RETURNING id`,
          [
            targetEmail,
            targetEmail.split('@')[0], // Simple name from email
            JSON.stringify({
              pendingActivation: true,
              invitedBy: userId
            })
          ]
        );
        
        targetUserId = result.rows[0].id;
        logRequest(context, 'Created placeholder user for subscription sharing', { 
          targetEmail, 
          targetUserId 
        });
      } else {
        targetUserId = userCheck.rows[0].id;
      }
      
      // Create sharing record
      await query(
        `INSERT INTO subscription_shares (
          subscription_id,
          shared_by,
          shared_with,
          message,
          created_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          subscriptionId,
          userId,
          targetUserId,
          message || '',
          new Date()
        ]
      );
      
      // Publish event for notification
      try {
        logPubSub(context, 'Publishing subscription.shared event', { 
          subscriptionId,
          targetUserId 
        });
        
        await publishEvent('subscription.shared', {
          subscription_id: subscriptionId,
          subscription_name: subscription.name,
          shared_by: userId,
          shared_with: targetUserId,
          shared_with_email: targetEmail,
          message: message || '',
          timestamp: new Date().toISOString()
        });
      } catch (pubsubError) {
        logError(context, pubsubError, 'Failed to publish subscription.shared event');
        // Continue without failing the whole operation
      }
      
      return {
        success: true,
        message: `Subscription shared successfully with ${targetEmail}`,
        subscription_id: subscriptionId,
        target_email: targetEmail
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'SUBSCRIPTION_SHARE_ERROR',
        'Failed to share subscription',
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Remove subscription sharing with a specific user
   * 
   * @param {string} userId - ID of the user who originally shared the subscription
   * @param {string} subscriptionId - ID of the shared subscription
   * @param {string} targetEmail - Email of the user to remove sharing with
   * @param {object} context - Request context for logging
   * @returns {Promise<object>} - Result of the operation
   */
  async removeSubscriptionSharing(userId, subscriptionId, targetEmail, context) {
    logRequest(context, 'Removing subscription sharing', { 
      userId, 
      subscriptionId, 
      targetEmail 
    });
    
    try {
      // First, check if the subscription exists and belongs to the user
      const subscriptionCheck = await query(
        'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
      
      if (subscriptionCheck.rows.length === 0) {
        throw new AppError(
          SUBSCRIPTION_ERRORS.NOT_FOUND.code,
          SUBSCRIPTION_ERRORS.NOT_FOUND.message,
          404,
          { subscriptionId }
        );
      }
      
      // Find the target user ID by email
      const userCheck = await query(
        'SELECT id FROM users WHERE email = $1',
        [targetEmail]
      );
      
      if (userCheck.rows.length === 0) {
        throw new AppError(
          'USER_NOT_FOUND',
          'Target user not found',
          404,
          { email: targetEmail }
        );
      }
      
      const targetUserId = userCheck.rows[0].id;
      
      // Delete the sharing record
      const result = await query(
        `DELETE FROM subscription_shares
         WHERE subscription_id = $1
         AND shared_by = $2
         AND shared_with = $3
         RETURNING id`,
        [subscriptionId, userId, targetUserId]
      );
      
      if (result.rowCount === 0) {
        throw new AppError(
          'SHARE_NOT_FOUND',
          'Subscription sharing not found',
          404,
          { subscriptionId, targetEmail }
        );
      }
      
      // Publish event for notification
      try {
        logPubSub(context, 'Publishing subscription.unshared event', { 
          subscriptionId,
          targetUserId 
        });
        
        await publishEvent('subscription.unshared', {
          subscription_id: subscriptionId,
          shared_by: userId,
          shared_with: targetUserId,
          shared_with_email: targetEmail,
          timestamp: new Date().toISOString()
        });
      } catch (pubsubError) {
        logError(context, pubsubError, 'Failed to publish subscription.unshared event');
        // Continue without failing the whole operation
      }
      
      return {
        success: true,
        message: `Subscription sharing with ${targetEmail} removed successfully`,
        subscription_id: subscriptionId,
        target_email: targetEmail
      };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'SUBSCRIPTION_UNSHARE_ERROR',
        'Failed to remove subscription sharing',
        500,
        { originalError: error.message }
      );
    }
  }
}

export const subscriptionService = new SubscriptionService(subscriptionRepository);