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

  async getPublicTemplates(context, page = 1, limit = 10) {
    logRequest(context, 'Fetching public templates');

    // Built-in templates
    const builtInTemplates = [
      {
        id: 'boe-general',
        name: 'BOE General',
        description: 'Seguimiento general del Boletín Oficial del Estado',
        type: 'boe',
        prompts: ['disposición', 'ley', 'real decreto'],
        frequency: 'daily',
        isBuiltIn: true,
        logo: 'https://www.boe.es/favicon.ico'
      },
      {
        id: 'boe-subvenciones',
        name: 'Subvenciones BOE',
        description: 'Alertas de subvenciones y ayudas públicas',
        type: 'boe',
        prompts: ['subvención', 'ayuda', 'convocatoria'],
        frequency: 'immediate',
        isBuiltIn: true,
        logo: 'https://www.boe.es/favicon.ico'
      },
      {
        id: 'real-estate-rental',
        name: 'Alquiler de Viviendas',
        description: 'Búsqueda de alquileres en zonas específicas',
        type: 'real-estate',
        prompts: ['alquiler', 'piso', 'apartamento'],
        frequency: 'immediate',
        isBuiltIn: true,
        logo: 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png'
      }
    ];

    try {
      // Calculate offset
      const offset = (page - 1) * limit;

      // Get user templates count
      const countResult = await query(
        `SELECT COUNT(*) 
         FROM subscription_templates t 
         WHERE t.is_public = true`,
        []
      );

      const userTemplatesCount = parseInt(countResult.rows[0].count);
      const totalCount = userTemplatesCount + builtInTemplates.length;
      const totalPages = Math.ceil(totalCount / limit);

      // Get user-created templates
      const result = await query(
        `SELECT 
          t.id,
          t.name,
          t.description,
          t.type,
          t.prompts,
          t.frequency,
          t.created_by as "createdBy",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt"
        FROM subscription_templates t
        WHERE t.is_public = true
        ORDER BY t.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      logRequest(context, 'Public templates retrieved', {
        count: templates.length,
        builtInCount: builtInTemplates.length,
        userCount: result.rows.length,
        page,
        totalPages,
        totalCount
      });

      return {
        templates,
        pagination: {
          page,
          limit,
          totalPages,
          totalCount,
          hasMore: page < totalPages
        }
      };
    } catch (error) {
      logError(context, error);
      throw new AppError(
        'TEMPLATE_FETCH_ERROR',
        'Failed to fetch public templates',
        500
      );
    }
  }

  async getTemplateById(templateId, context) {
    logRequest(context, 'Fetching template by ID', { templateId });

    // Check built-in templates first
    const builtInTemplate = builtInTemplates.find(t => t.id === templateId);
    if (builtInTemplate) {
      return builtInTemplate;
    }

    try {
      const result = await query(
        `SELECT 
          t.id,
          t.name,
          t.description,
          t.type,
          t.prompts,
          t.frequency,
          t.created_by as "createdBy",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt"
        FROM subscription_templates t
        WHERE t.id = $1 AND t.is_public = true`,
        [templateId]
      );

      if (result.rows.length === 0) {
        throw new AppError(
          'TEMPLATE_NOT_FOUND',
          'Template not found',
          404,
          { templateId }
        );
      }

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'TEMPLATE_FETCH_ERROR',
        'Failed to fetch template',
        500
      );
    }
  }

  async createFromTemplate(userId, templateId, context) {
    logRequest(context, 'Creating subscription from template', { userId, templateId });

    try {
      const template = await this.getTemplateById(templateId, context);

      const result = await query(
        `INSERT INTO subscriptions (
          user_id,
          type,
          name,
          description,
          prompts,
          frequency,
          active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
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
          template.type,
          template.name,
          template.description,
          template.prompts,
          template.frequency
        ]
      );

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'SUBSCRIPTION_CREATE_ERROR',
        'Failed to create subscription from template',
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

    try {
      const result = await query(
        `DELETE FROM subscriptions
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
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

      return { success: true };
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        SUBSCRIPTION_ERRORS.DELETE_ERROR.code,
        'Failed to delete subscription',
        500
      );
    }
  }

  async shareSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Sharing subscription', { userId, subscriptionId });

    try {
      const subscription = await this.getSubscriptionById(userId, subscriptionId, context);

      const result = await query(
        `INSERT INTO subscription_templates (
          type,
          name,
          description,
          default_prompts,
          default_settings,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id,
          type,
          name,
          description,
          default_prompts as prompts,
          created_at as "createdAt"`,
        [
          subscription.type,
          subscription.name,
          subscription.description,
          subscription.prompts,
          subscription.settings || {},
          userId
        ]
      );

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'SHARE_ERROR',
        'Failed to share subscription',
        500
      );
    }
  }

  async unshareSubscription(userId, subscriptionId, context) {
    logRequest(context, 'Unsharing subscription', { userId, subscriptionId });

    try {
      const result = await query(
        `DELETE FROM subscription_templates
        WHERE created_by = $1 AND id = (
          SELECT template_id 
          FROM subscriptions 
          WHERE id = $2 AND user_id = $1
        )
        RETURNING id`,
        [userId, subscriptionId]
      );

      if (result.rows.length === 0) {
        throw new AppError(
          'TEMPLATE_NOT_FOUND',
          'Shared template not found',
          404,
          { subscriptionId }
        );
      }

      return { success: true };
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'UNSHARE_ERROR',
        'Failed to unshare subscription',
        500
      );
    }
  }
}

export const subscriptionService = new SubscriptionService();