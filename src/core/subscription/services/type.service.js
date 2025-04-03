import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';

class TypeService {
  // Add a getTypes method that calls getSubscriptionTypes for backwards compatibility
  async getTypes(userId, context) {
    logRequest(context, 'Fetching subscription types (via getTypes)', { userId });
    return this.getSubscriptionTypes(context);
  }

  // Default subscription types to use as fallback
  get defaultTypes() {
    return [
      {
        id: 'boe',
        name: 'BOE',
        description: 'Boletín Oficial del Estado',
        icon: 'FileText',
        isSystem: true,
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'doga',
        name: 'DOGA',
        description: 'Diario Oficial de Galicia',
        icon: 'FileText',
        isSystem: true,
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'real-estate',
        name: 'Inmobiliaria',
        description: 'Búsquedas inmobiliarias',
        icon: 'Home',
        isSystem: true,
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async getSubscriptionTypes(context) {
    logRequest(context, 'Fetching subscription types');

    try {
      // First try to get types from database
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

        // If we got results from the database, return them
        if (result && result.rows && result.rows.length > 0) {
          logRequest(context, 'Subscription types retrieved from database', {
            count: result.rows.length
          });
          
          return result.rows;
        }
        
        // If no results from database, try to create default types
        logRequest(context, 'No subscription types found in database, attempting to create defaults');
        
        // Try to create default types in database
        for (const defaultType of this.defaultTypes) {
          try {
            await query(
              `INSERT INTO subscription_types (id, name, description, icon, is_system)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING`,
              [defaultType.id, defaultType.name, defaultType.description, defaultType.icon, defaultType.isSystem]
            );
          } catch (insertError) {
            logError(context, insertError, `Error creating default type ${defaultType.id}`);
            // Continue with next type even if this one fails
          }
        }
        
        // Try to fetch again after creating defaults
        const retryResult = await query(
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
        
        if (retryResult && retryResult.rows && retryResult.rows.length > 0) {
          logRequest(context, 'Subscription types retrieved after creating defaults', {
            count: retryResult.rows.length
          });
          
          return retryResult.rows;
        }
      } catch (dbError) {
        // Log the database error but don't fail - we'll use default types
        logError(context, dbError, 'Database error fetching subscription types');
      }
      
      // If we get here, either the database query failed or returned no results
      // Use default types as fallback
      logRequest(context, 'Using default subscription types', {
        count: this.defaultTypes.length,
        reason: 'Database error or no types found'
      });
      
      return this.defaultTypes;
    } catch (error) {
      // This catch will handle any unexpected errors in our fallback logic
      logError(context, error, 'Unexpected error in getSubscriptionTypes');
      
      // Always return default types rather than throw an error
      return this.defaultTypes;
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