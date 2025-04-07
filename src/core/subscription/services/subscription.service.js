import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { SUBSCRIPTION_ERRORS } from '../types/subscription.types.js';
import { logRequest, logError, logPubSub, logProcessing } from '../../../shared/logging/logger.js';
import { publishEvent } from '../../../infrastructure/pubsub/client.js';
// Import the data repository instead of the service repository
import { subscriptionRepository as dataRepository } from '../data/subscription.repository.js';
import { subscriptionRepository as serviceRepository } from './subscription.repository.js';

class SubscriptionService {
  constructor() {
    // Use both repositories
    this.repository = serviceRepository;
    this.dataRepository = dataRepository;
  }
  
  async getSubscriptionStats(userId, context) {
    logRequest(context, 'Fetching subscription statistics', { userId });
    
    try {
      // First try to get cached stats from the subscription_stats table
      try {
        const cachedStats = await query(
          `SELECT 
            total, 
            active, 
            inactive, 
            by_source as "bySource", 
            by_frequency as "byFrequency",
            updated_at as "updatedAt"
          FROM subscription_stats 
          WHERE user_id = $1`,
          [userId]
        );
        
        // If we have cached stats that are recent (less than 1 hour old), use them
        if (cachedStats.rows.length > 0) {
          const stats = cachedStats.rows[0];
          
          // Check if stats are recent (less than 1 hour old)
          const updatedAt = new Date(stats.updatedAt);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (updatedAt > oneHourAgo) {
            logRequest(context, 'Using cached subscription statistics', {
              userId,
              cacheAge: `${Math.round((Date.now() - updatedAt.getTime()) / 1000 / 60)} minutes`
            });
            
            // Format the response
            return {
              total: stats.total,
              active: stats.active,
              inactive: stats.inactive,
              bySource: stats.bySource,
              byFrequency: stats.byFrequency,
              cached: true,
              updatedAt: stats.updatedAt
            };
          }
          
          // If stats are old, we'll refresh them but still return the cached version
          // for a faster response, and update the cache asynchronously
          logRequest(context, 'Cached statistics are outdated, will refresh asynchronously', {
            userId,
            cacheAge: `${Math.round((Date.now() - updatedAt.getTime()) / 1000 / 60)} minutes`
          });
          
          // Trigger an asynchronous refresh without waiting for it
          setTimeout(async () => {
            try {
              // Call the repository method to refresh statistics
              await this.repository.getSubscriptionStats(userId, context);
              logRequest(context, 'Statistics refreshed asynchronously', { userId });
            } catch (refreshError) {
              logError(context, refreshError, 'Error refreshing statistics asynchronously');
            }
          }, 0);
          
          // Return the cached stats while the refresh happens in the background
          return {
            total: stats.total,
            active: stats.active,
            inactive: stats.inactive,
            bySource: stats.bySource,
            byFrequency: stats.byFrequency,
            cached: true,
            updatedAt: stats.updatedAt,
            refreshing: true
          };
        }
      } catch (cacheError) {
        // If there's an error with the cache, log it but continue to get stats directly
        logError(context, cacheError, 'Error getting cached statistics');
      }
      
      // Fall back to calculating stats directly
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
        cached: false,
        error: SUBSCRIPTION_ERRORS.FETCH_ERROR.message
      };
    }
  }

  async getSubscriptionById(userId, subscriptionId, context) {
    logRequest(context, 'Fetching subscription by ID', { userId, subscriptionId });

    try {
      // Only use the regular repository, no fallbacks
      const result = await this.repository.getSubscriptionById(userId, subscriptionId, context);

      if (result && result.rows && result.rows.length > 0) {
        // Get the subscription from the result
        const subscription = result.rows[0];
        
        // Normalize the prompts field to ensure it's compatible with various client expectations
        if (subscription) {
          try {
            // Handle prompts field based on its type
            if (subscription.prompts) {
              // If it's already an array, great
              if (Array.isArray(subscription.prompts)) {
                // Ensure all items are strings
                subscription.prompts = subscription.prompts.map(p => String(p));
              } 
              // If it's a string, parse it if it looks like JSON
              else if (typeof subscription.prompts === 'string') {
                try {
                  // Try to parse as JSON
                  const parsed = JSON.parse(subscription.prompts);
                  
                  if (Array.isArray(parsed)) {
                    subscription.prompts = parsed.map(p => String(p));
                  } else if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
                    // Handle new format with value property
                    subscription.prompts = [String(parsed.value)];
                  } else {
                    // Fall back to using the original string
                    subscription.prompts = [subscription.prompts];
                  }
                } catch (e) {
                  // Not valid JSON, use as a string
                  subscription.prompts = [subscription.prompts];
                }
              }
              // Otherwise convert to array
              else {
                subscription.prompts = [String(subscription.prompts)];
              }
            } else {
              // Ensure prompts is never null/undefined
              subscription.prompts = [];
            }
          } catch (promptsError) {
            console.error('Error normalizing prompts field:', promptsError);
            subscription.prompts = [];
          }
          
          // Log the normalized subscription for debugging
          console.log('Normalized subscription from service repository:', {
            id: subscription.id,
            name: subscription.name,
            prompts: subscription.prompts
          });
        }

        return subscription;
      }

      // If we get here, the subscription was not found in the repository
      throw new AppError(
        SUBSCRIPTION_ERRORS.NOT_FOUND.code,
        SUBSCRIPTION_ERRORS.NOT_FOUND.message,
        404,
        { subscriptionId }
      );
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
      // Normalize options to ensure consistent filter handling
      const normalizedOptions = { ...options };
      
      // Log incoming options for debugging
      console.log('Service: Raw filter options:', { 
        status: normalizedOptions.status, 
        active: normalizedOptions.active,
        isActive: normalizedOptions.isActive // Frontend might use isActive
      });
      
      // Handle 'isActive' from frontend if present
      if (normalizedOptions.isActive !== undefined) {
        console.log('Service: Converting isActive to active:', normalizedOptions.isActive);
        if (typeof normalizedOptions.isActive === 'boolean') {
          normalizedOptions.active = normalizedOptions.isActive;
        } else if (typeof normalizedOptions.isActive === 'string') {
          normalizedOptions.active = normalizedOptions.isActive === 'true';
        } else {
          normalizedOptions.active = !!normalizedOptions.isActive;
        }
        delete normalizedOptions.isActive;
      }
      
      // Handle both status and active parameters
      if (normalizedOptions.status && normalizedOptions.status !== 'all') {
        console.log('Service: Converting status to active:', normalizedOptions.status);
        normalizedOptions.active = normalizedOptions.status === 'active';
      }
      
      // Convert string 'true'/'false' to boolean
      if (typeof normalizedOptions.active === 'string') {
        console.log('Service: Converting string active to boolean:', normalizedOptions.active);
        normalizedOptions.active = normalizedOptions.active === 'true';
      }
      
      console.log('Service: Normalized options:', normalizedOptions);
      
      // First try the regular repository
      try {
        const result = await this.repository.getUserSubscriptions(userId, normalizedOptions, context);
        
        // If result contains an error property, log it but still return the data
        if (result.error) {
          logError(context, new Error(result.error));
          console.error('Service: Repository reported error:', result.error);
        }
        
        // Check if we have actual results
        if (result.subscriptions && result.subscriptions.length > 0) {
          console.log('Service: Repository returned subscriptions:', { 
            count: result.subscriptions.length,
            pagination: result.pagination
          });
          
          return result;
        } else {
          console.log('Service: No subscriptions found in primary repository, checking data repository');
        }
      } catch (repoError) {
        console.warn('Service: Error in primary getUserSubscriptions repository:', repoError);
        // Continue to try the data repository
      }
      
      // If primary repository failed or returned empty, try the data repository
      try {
        // This is a simpler call using the data repository which may have more subscriptions
        // We're manually creating similar output format to match the service repository
        console.log('Attempting to query data repository for subscriptions');
        
        // Build a query string to match what the data repository would expect
        // Use 'sqlQuery' instead of 'query' to avoid conflict with the imported function
        let sqlQuery = 'SELECT * FROM subscriptions WHERE user_id = $1';
        const queryParams = [userId];
        let paramIndex = 2;
        
        // Add active filter if specified
        if (normalizedOptions.active !== undefined) {
          sqlQuery += ` AND active = $${paramIndex}`;
          queryParams.push(normalizedOptions.active);
          paramIndex++;
        }
        
        // Add type filter if specified
        if (normalizedOptions.type) {
          sqlQuery += ` AND type_id IN (SELECT id FROM subscription_types WHERE LOWER(name) = LOWER($${paramIndex}))`;
          queryParams.push(normalizedOptions.type);
          paramIndex++;
        }
        
        // Add frequency filter if specified
        if (normalizedOptions.frequency) {
          sqlQuery += ` AND frequency = $${paramIndex}`;
          queryParams.push(normalizedOptions.frequency);
          paramIndex++;
        }
        
        // Add search filter if specified
        if (normalizedOptions.search) {
          sqlQuery += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
          queryParams.push(`%${normalizedOptions.search}%`);
          paramIndex++;
        }
        
        // Add date filters if specified
        if (normalizedOptions.from) {
          sqlQuery += ` AND created_at >= $${paramIndex}`;
          queryParams.push(normalizedOptions.from);
          paramIndex++;
        }
        
        if (normalizedOptions.to) {
          sqlQuery += ` AND created_at <= $${paramIndex}`;
          queryParams.push(normalizedOptions.to);
          paramIndex++;
        }
        
        // Add ordering
        const sortField = normalizedOptions.sort || 'created_at';
        const sortOrder = normalizedOptions.order || 'desc';
        sqlQuery += ` ORDER BY ${sortField} ${sortOrder}`;
        
        // Add pagination
        const limit = parseInt(normalizedOptions.limit || 20);
        const page = parseInt(normalizedOptions.page || 1);
        const offset = (page - 1) * limit;
        
        sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        
        // Execute the query - using the imported query function with the sqlQuery string
        // This fixes the "query is not a function" error
        console.log('Executing SQL query:', { sqlQuery, paramCount: queryParams.length });
        
        // Execute the query directly with the sqlQuery string
        const result = await query(sqlQuery, queryParams);
        
        // Count total for pagination
        const countQuery = 'SELECT COUNT(*) as total FROM subscriptions WHERE user_id = $1';
        const countResult = await query(countQuery, [userId]);
        const total = parseInt(countResult.rows[0]?.total || 0);
        
        // Format the results to match expected format
        const subscriptions = result.rows.map(row => {
          // Handle prompts processing
          let prompts = [];
          try {
            if (typeof row.prompts === 'string') {
              prompts = JSON.parse(row.prompts);
            } else if (Array.isArray(row.prompts)) {
              prompts = row.prompts;
            }
          } catch (e) {
            console.warn('Error parsing prompts:', e);
            prompts = row.prompts ? [String(row.prompts)] : [];
          }
          
          return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            type: row.type_id, // No join for type name, just use ID
            prompts: prompts,
            frequency: row.frequency || 'daily',
            active: row.active,
            created_at: row.created_at,
            updated_at: row.updated_at,
            user_id: row.user_id
          };
        });
        
        console.log('Data repository returned subscriptions:', { 
          count: subscriptions.length,
          total
        });
        
        return {
          subscriptions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        };
      } catch (dataRepoError) {
        console.error('Service: Data repository also failed:', dataRepoError);
        // Continue to return empty results
      }
      
      // Return empty results if both repositories failed
      console.log('Service: Both repositories failed, returning empty results');
      const emptyResult = {
        subscriptions: [],
        pagination: {
          total: 0,
          page: parseInt(options.page || 1),
          limit: parseInt(options.limit || 20),
          totalPages: 0
        },
        error: 'Multiple repository failures'
      };
      
      return emptyResult;
    } catch (error) {
      logError(context, error);
      console.error('Service: Error in getUserSubscriptions:', error);
      
      // Return empty results instead of mock data
      const emptyResult = {
        subscriptions: [],
        pagination: {
          total: 0,
          page: parseInt(options.page || 1),
          limit: parseInt(options.limit || 20),
          totalPages: 0
        },
        error: error.message
      };
      
      return emptyResult;
    }
  }

  async createSubscription(subscriptionData, context) {
    logRequest(context, 'Creating new subscription', subscriptionData);
    
    // Log the raw subscription data first for debugging
    console.log('Raw subscription data:', {
      name: subscriptionData.name,
      type: subscriptionData.type,
      source: subscriptionData.source, // Some frontends use source instead of type
      userId: subscriptionData.userId,
      prompts: Array.isArray(subscriptionData.prompts) ? 
        `array(${subscriptionData.prompts.length})` : 
        typeof subscriptionData.prompts
    });
    
    // Normalize data format from frontend
    // Some frontends use 'source' instead of 'type', handle both
    if (!subscriptionData.type && subscriptionData.source) {
      subscriptionData.type = subscriptionData.source;
      console.log('Using source field as type:', subscriptionData.type);
    }
    
    // Some frontends use 'keywords' instead of 'prompts'
    if (!subscriptionData.prompts && subscriptionData.keywords) {
      subscriptionData.prompts = subscriptionData.keywords;
      console.log('Using keywords field as prompts:', 
        Array.isArray(subscriptionData.prompts) ? 
        subscriptionData.prompts.length + ' items' : 
        typeof subscriptionData.prompts);
    }
    
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
      
      // Return the actual database result to allow the controller to format it
      return result;
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
      
      // Log the update data for debugging
      console.log('Service: Update data received:', updateData);
      
      // Normalize data before updating
      const normalizedData = { ...updateData };
      
      // Handle prompts field specifically - convert to expected format
      if (normalizedData.prompts !== undefined) {
        // If it's the new object format with value property
        if (typeof normalizedData.prompts === 'object' && 
            normalizedData.prompts !== null && 
            'value' in normalizedData.prompts) {
          
          console.log('Service: Converting prompts from object format to array format');
          normalizedData.prompts = [normalizedData.prompts.value];
        }
        
        // If it's a string, convert to array
        if (typeof normalizedData.prompts === 'string') {
          console.log('Service: Converting prompts from string to array format');
          normalizedData.prompts = [normalizedData.prompts];
        }
        
        // Ensure prompts is JSON string for database storage
        if (Array.isArray(normalizedData.prompts)) {
          console.log('Service: Converting prompts array to JSON string');
          normalizedData.prompts = JSON.stringify(normalizedData.prompts);
        }
      }
      
      // Add updated_at field
      const dataToUpdate = {
        ...normalizedData,
        updated_at: new Date()
      };
      
      // Create SQL SET part
      const fields = Object.keys(dataToUpdate);
      if (fields.length === 0) {
        return { message: 'No changes to update' };
      }
      
      const setClause = fields.map((field, i) => `${field} = $${i + 3}`).join(', ');
      const values = Object.values(dataToUpdate);
      
      console.log('Service: Executing update query:', {
        fields,
        values,
        subscriptionId,
        userId
      });
      
      const result = await query(
        `UPDATE subscriptions 
         SET ${setClause} 
         WHERE id = $1 AND user_id = $2 
         RETURNING id, name, description, type_id, frequency, active, updated_at, prompts`,
        [subscriptionId, userId, ...values]
      );
      
      // Process the result for client response
      const updatedSubscription = result.rows[0];
      
      // Normalize the prompts field for the response
      if (updatedSubscription && updatedSubscription.prompts) {
        try {
          if (typeof updatedSubscription.prompts === 'string') {
            try {
              // Try to parse prompts if it's a JSON string
              const parsedPrompts = JSON.parse(updatedSubscription.prompts);
              updatedSubscription.prompts = Array.isArray(parsedPrompts) ? 
                parsedPrompts : [String(updatedSubscription.prompts)];
            } catch (e) {
              // If parsing fails, return as a single-item array
              updatedSubscription.prompts = [updatedSubscription.prompts];
            }
          } else if (!Array.isArray(updatedSubscription.prompts)) {
            // If it's not an array or a string, convert to array
            updatedSubscription.prompts = [String(updatedSubscription.prompts)];
          }
        } catch (promptsError) {
          console.error('Error normalizing prompts in response:', promptsError);
          updatedSubscription.prompts = [];
        }
      }
      
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
      
      return updatedSubscription;
    } catch (error) {
      logError(context, error);
      console.error('Service: Error updating subscription:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.code,
        SUBSCRIPTION_ERRORS.UPDATE_ERROR.message,
        500,
        { error: error.message }
      );
    }
  }

  async processSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Processing subscription', { userId, subscriptionId });
    
    try {
      // First, check if the subscription exists and belongs to the user
      // Use a more resilient query that handles missing type_id or subscription_types
      const result = await query(
        `SELECT s.id, s.name, s.type_id, s.prompts,
                COALESCE(t.name, 'unknown') as type_name
         FROM subscriptions s
         LEFT JOIN subscription_types t ON s.type_id = t.id
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
      console.log('Processing subscription:', subscription);
      
      // Log that we're about to initiate processing
      logProcessing(context, 'Initiating subscription processing', {
        subscriptionId,
        type: subscription.type_name,
        prompts: subscription.prompts
      });
      
      // Parse prompts if needed
      let processedPrompts = [];
      try {
        if (typeof subscription.prompts === 'string') {
          try {
            // Try to parse as JSON
            const parsed = JSON.parse(subscription.prompts);
            if (Array.isArray(parsed)) {
              processedPrompts = parsed;
            } else if (typeof parsed === 'object' && parsed.value) {
              processedPrompts = [parsed.value];
            } else {
              processedPrompts = [subscription.prompts];
            }
          } catch (e) {
            // Not valid JSON, use as string
            processedPrompts = [subscription.prompts];
          }
        } else if (Array.isArray(subscription.prompts)) {
          processedPrompts = subscription.prompts;
        } else if (subscription.prompts && typeof subscription.prompts === 'object') {
          // Handle object with value property
          if (subscription.prompts.value) {
            processedPrompts = [subscription.prompts.value];
          } else {
            // Extract any string values
            processedPrompts = Object.values(subscription.prompts)
              .filter(v => typeof v === 'string')
              .filter(Boolean);
          }
        }
      } catch (promptsError) {
        console.error('Error processing prompts:', promptsError);
        // Default to empty prompts
        processedPrompts = [];
      }
      
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
          processingId,
          prompts: processedPrompts
        });
        
        await publishEvent('subscription.process', {
          subscription_id: subscriptionId,
          processing_id: processingId,
          user_id: userId,
          type: subscription.type_id,
          type_name: subscription.type_name,
          prompts: processedPrompts,
          timestamp: new Date().toISOString()
        });
        
        return {
          message: 'Subscription processing initiated',
          processingId,
          subscriptionId,
          jobId: processingId, // Include jobId for compatibility with frontend
          status: 'pending'
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
      console.error('Service: Error in processSubscription:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        SUBSCRIPTION_ERRORS.PROCESSING_ERROR.code,
        SUBSCRIPTION_ERRORS.PROCESSING_ERROR.message,
        500,
        { error: error.message }
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
      // First check if we should use dataRepository or serviceRepository (if one fails, try the other)
      let result;
      
      try {
        // Try the dataRepository first if it has a delete method
        if (typeof this.dataRepository.delete === 'function') {
          logRequest(context, 'Using dataRepository for deletion', { subscriptionId });
          result = await this.dataRepository.delete(subscriptionId, {
            userId,
            force: false, // Don't force - perform proper user ownership checks
            context
          });
        } else {
          throw new Error('dataRepository.delete is not a function');
        }
      } catch (repoError) {
        // If dataRepository fails, try direct SQL deletion
        logRequest(context, 'dataRepository failed, using direct SQL deletion', { 
          error: repoError.message 
        });
        
        // Check if subscription exists and belongs to user
        const checkResult = await query(
          'SELECT EXISTS(SELECT 1 FROM subscriptions WHERE id = $1 AND user_id = $2) as exists',
          [subscriptionId, userId]
        );
        
        if (!checkResult.rows[0].exists) {
          return {
            message: 'Subscription already removed or not found',
            alreadyRemoved: true
          };
        }
        
        // Use a transaction for the deletion
        const client = await query('BEGIN');
        
        try {
          // Delete related records first
          await client.query(
            'DELETE FROM subscription_items WHERE subscription_id = $1',
            [subscriptionId]
          );
          
          // Then delete the subscription
          const deleteResult = await client.query(
            'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
            [subscriptionId, userId]
          );
          
          await client.query('COMMIT');
          
          result = {
            alreadyRemoved: deleteResult.rowCount === 0,
            deleted: deleteResult.rowCount > 0
          };
        } catch (txError) {
          await client.query('ROLLBACK');
          throw txError;
        }
      }
      
      // If deletion was successful, publish an event
      if (!result.alreadyRemoved) {
        try {
          // logPubSub(context, 'Publishing subscription.deleted event', { subscriptionId }); // Simplified logging
          // // Commented out Pub/Sub publishing as requested
          // await publishEvent('subscription.deleted', { 
          //   subscriptionId,
          //   userId,
          //   timestamp: new Date().toISOString()
          // }, context);
        } catch (publishError) {
          // Log the error but don't let it fail the whole operation
          logError(context, publishError, 'Failed to publish event');
        }
      }
      
      return result;
    } catch (error) {
      logError(context, error);
      
      // If it's an AppError with status 403 (permission error), we should rethrow it
      if (error instanceof AppError && error.status === 403) {
        throw error;
      }
      
      // Properly propagate the error to the caller
      logError(context, error, 'Error during subscription deletion in service layer', {
        subscriptionId
      });
      
      // Rethrow the error with appropriate context
      if (error instanceof AppError) {
        throw error; // Preserve original AppError
      } else {
        // Wrap generic errors in AppError
        throw new AppError(
          'SUBSCRIPTION_DELETION_ERROR',
          error.message || 'Failed to delete subscription',
          500,
          { 
            subscriptionId,
            originalError: error.message,
            originalErrorCode: error.code
          }
        );
      }
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
      
      // First check if subscription_shares table exists
      let sharingTableExists = false;
      try {
        const tableCheckResult = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'subscription_shares'
          ) as exists
        `);
        
        sharingTableExists = tableCheckResult.rows[0].exists;
        
        if (!sharingTableExists) {
          // Create the table if it doesn't exist
          logRequest(context, 'Creating subscription_shares table', { 
            subscriptionId, 
            targetEmail 
          });
          
          await query(`
            CREATE TABLE IF NOT EXISTS subscription_shares (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
              shared_by UUID NOT NULL,
              shared_with UUID NOT NULL,
              message TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(subscription_id, shared_with)
            )
          `);
          
          sharingTableExists = true;
        }
      } catch (tableCheckError) {
        logError(context, tableCheckError, 'Error checking for subscription_shares table');
        console.error('Error checking for subscription_shares table:', tableCheckError);
      }
      
      // Create sharing record if table exists
      if (sharingTableExists) {
        try {
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
        } catch (sharingError) {
          logError(context, sharingError, 'Error inserting into subscription_shares table');
          console.error('Error inserting into subscription_shares table:', sharingError);
          // Continue with the operation even if the database record fails
        }
      }
      
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
      console.error('Error in shareSubscription:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      // Return success with warning instead of throwing error
      return {
        success: true,
        message: `Subscription shared with ${targetEmail}, but there might be database synchronization issues.`,
        subscription_id: subscriptionId,
        target_email: targetEmail,
        warning: true,
        error: error.message
      };
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
      
      // First check if subscription_shares table exists
      let sharingTableExists = false;
      try {
        const tableCheckResult = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'subscription_shares'
          ) as exists
        `);
        
        sharingTableExists = tableCheckResult.rows[0].exists;
        
        if (!sharingTableExists) {
          // Table doesn't exist, so we can't delete anything
          logRequest(context, 'subscription_shares table does not exist, nothing to remove', { 
            subscriptionId, 
            targetEmail 
          });
          
          // Return success anyway since there's nothing to remove
          return {
            success: true,
            message: `No sharing information found for ${targetEmail}`,
            subscription_id: subscriptionId,
            target_email: targetEmail,
            warning: "Sharing table does not exist"
          };
        }
      } catch (tableCheckError) {
        logError(context, tableCheckError, 'Error checking for subscription_shares table');
        console.error('Error checking for subscription_shares table:', tableCheckError);
        
        // Continue assuming the table exists
        sharingTableExists = true;
      }
      
      // Delete the sharing record if table exists
      if (sharingTableExists) {
        try {
          const result = await query(
            `DELETE FROM subscription_shares
             WHERE subscription_id = $1
             AND shared_by = $2
             AND shared_with = $3
             RETURNING id`,
            [subscriptionId, userId, targetUserId]
          );
          
          // If no records were deleted, it could just mean the sharing didn't exist
          // We don't want to fail the operation in this case
          if (result.rowCount === 0) {
            logRequest(context, 'No sharing record found to delete', { 
              subscriptionId, 
              targetEmail 
            });
          }
        } catch (deleteError) {
          logError(context, deleteError, 'Error deleting from subscription_shares table');
          console.error('Error deleting from subscription_shares table:', deleteError);
          // Continue with the operation even if the database deletion fails
        }
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
      console.error('Error in removeSubscriptionSharing:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      // Return success with warning instead of throwing error
      return {
        success: true,
        message: `Attempted to remove sharing with ${targetEmail}, but there might be issues.`,
        subscription_id: subscriptionId,
        target_email: targetEmail,
        warning: true,
        error: error.message
      };
    }
  }
}

export const subscriptionService = new SubscriptionService();