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
        logo_url: 'https://storage.googleapis.com/nifya-assets/WebPage/Subs_types_logo/LOGO-BOE-min.png',
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
        logo_url: 'https://storage.googleapis.com/nifya-assets/WebPage/Subs_types_logo/doga.jpg',
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
        logo_url: 'https://storage.googleapis.com/nifya-assets/WebPage/Subs_types_logo/house-key.png',
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
      // First, ensure the subscription_types table exists
      await this._ensureTypesTableExists(context);
      
      // Try to get types from database
      try {
        const result = await query(
          `SELECT 
            id,
            name,
            description,
            icon,
            logo_url,
            is_system as "isSystem",
            created_by as "createdBy",
            created_at as "createdAt",
            updated_at as "updatedAt",
            display_name as "displayName"
          FROM subscription_types
          ORDER BY is_system DESC, name ASC`,
          []
        );

        // If we got results from the database, return them
        if (result && result.rows && result.rows.length > 0) {
          logRequest(context, 'Subscription types retrieved from database', {
            count: result.rows.length
          });
          
          // Map fields for frontend compatibility
          const mappedTypes = result.rows.map(type => ({
            ...type,
            // Ensure logo_url is available
            logo_url: type.logo_url || null,
            // Ensure display_name is used properly
            display_name: type.displayName || type.name
          }));
          
          return mappedTypes;
        }
        
        // If no results from database, try to create default types
        logRequest(context, 'No subscription types found in database, attempting to create defaults');
        
        // Try to create default types in database
        for (const defaultType of this.defaultTypes) {
          try {
            await query(
              `INSERT INTO subscription_types (id, name, description, icon, logo_url, is_system, display_name)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [
                defaultType.id, 
                defaultType.name, 
                defaultType.description, 
                defaultType.icon,
                defaultType.logo_url, 
                defaultType.isSystem || true,
                defaultType.name
              ]
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
            logo_url,
            is_system as "isSystem",
            created_by as "createdBy",
            created_at as "createdAt",
            updated_at as "updatedAt",
            display_name as "displayName"
          FROM subscription_types
          ORDER BY is_system DESC, name ASC`,
          []
        );
        
        if (retryResult && retryResult.rows && retryResult.rows.length > 0) {
          logRequest(context, 'Subscription types retrieved after creating defaults', {
            count: retryResult.rows.length
          });
          
          // Map fields for frontend compatibility
          const mappedTypes = retryResult.rows.map(type => ({
            ...type,
            // Ensure logo_url is available
            logo_url: type.logo_url || null,
            // Ensure display_name is used properly
            display_name: type.displayName || type.name
          }));
          
          return mappedTypes;
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
  
  // Create database tables for subscription types if they don't exist
  async _ensureTypesTableExists(context) {
    logRequest(context, 'Checking if subscription_types table exists');
    
    try {
      // Check if subscription_types table exists
      const checkTableExists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'subscription_types'
        );
      `);
      
      const tableExists = checkTableExists.rows[0].exists;
      
      if (!tableExists) {
        logRequest(context, 'Warning: subscription_types table does not exist', {
          severity: 'warning'
        });
        return false;
      }
      
      // Check if display_name column exists
      try {
        const checkColumnExists = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'subscription_types' AND column_name = 'display_name'
          );
        `);
        
        const columnExists = checkColumnExists.rows[0].exists;
        
        if (!columnExists) {
          logRequest(context, 'Warning: display_name column does not exist in subscription_types table', {
            severity: 'warning'
          });
        }
        
        // Check if logo_url column exists
        const checkLogoColumnExists = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'subscription_types' AND column_name = 'logo_url'
          );
        `);
        
        const logoColumnExists = checkLogoColumnExists.rows[0].exists;
        
        if (!logoColumnExists) {
          logRequest(context, 'Warning: logo_url column does not exist in subscription_types table', {
            severity: 'warning'
          });
        }
      } catch (columnError) {
        logError(context, columnError, 'Error checking columns in subscription_types table');
      }
      
      return tableExists;
    } catch (error) {
      logError(context, error, 'Error checking if subscription_types table exists');
      return false;
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
          logo_url,
          created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING 
          id,
          name,
          description,
          icon,
          logo_url,
          is_system as "isSystem",
          created_by as "createdBy",
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [data.name, data.description, data.icon, data.logo_url, userId]
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