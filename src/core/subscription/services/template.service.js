import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { builtInTemplates } from '../data/built-in-templates.js';
import { publishEvent } from '../../../infrastructure/pubsub/client.js';

class TemplateService {
  async getPublicTemplates(context, page = 1, limit = 10) {
    logRequest(context, 'Fetching public templates');

    try {
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
          t.icon,
          t.logo,
          t.metadata,
          t.is_public as "isPublic"
        FROM subscription_templates t
        WHERE t.is_public = true
        ORDER BY t.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Transform user templates to match the format
      const userTemplates = result.rows.map(template => ({
        ...template,
        isBuiltIn: false
      }));

      // Combine built-in and user templates
      const templates = [...builtInTemplates, ...userTemplates];

      logRequest(context, 'Public templates retrieved', {
        count: templates.length,
        builtInCount: builtInTemplates.length,
        userCount: userTemplates.length,
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
          t.icon,
          t.logo,
          t.metadata,
          t.is_public as "isPublic"
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

      // Transform to match the format
      const template = {
        ...result.rows[0],
        isBuiltIn: false
      };

      return template;
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

  async createFromTemplate(userId, templateId, customization = {}, context) {
    logRequest(context, 'Creating subscription from template', { 
      userId, 
      templateId,
      customization 
    });

    try {
      // Get template details
      const template = await this.getTemplateById(templateId, context);
      if (!template) {
        throw new AppError(
          'TEMPLATE_NOT_FOUND',
          'Template not found',
          404,
          { templateId }
        );
      }

      // Get subscription type ID for the template type
      const typeResult = await query(
        `SELECT id FROM subscription_types WHERE name = $1 AND is_system = true`,
        [template.type.toUpperCase()]
      );

      if (typeResult.rows.length === 0) {
        throw new AppError(
          'TYPE_NOT_FOUND',
          'Subscription type not found',
          404,
          { type: template.type }
        );
      }

      const typeId = typeResult.rows[0].id;

      // Use customization options or template defaults
      const prompts = customization.prompts || template.prompts;
      const frequency = customization.frequency || template.frequency;

      // Validate prompts length
      if (prompts.length > 3) {
        throw new AppError(
          'INVALID_PROMPTS',
          'Maximum 3 prompts allowed',
          400,
          { providedCount: prompts.length }
        );
      }

      // Create subscription from template
      const result = await query(
        `INSERT INTO subscriptions (
          user_id,
          type_id,
          name,
          description,
          prompts,
          logo,
          frequency,
          active,
          settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
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
          typeId,
          template.name,
          template.description,
          prompts,
          template.logo,
          frequency,
          JSON.stringify(template.metadata || {})
        ]
      );

      const subscription = result.rows[0];

      // Publish subscription created event
      await publishEvent('subscription-events', {
        type: 'subscription-created',
        data: {
          userId,
          subscriptionId: subscription.id,
          templateId,
          prompts: subscription.prompts,
          frequency: subscription.frequency,
          isCustomized: !!customization.prompts || !!customization.frequency
        }
      });

      logRequest(context, 'Subscription created from template', {
        userId,
        templateId,
        subscriptionId: subscription.id,
        customized: !!customization.prompts || !!customization.frequency
      });

      return subscription;
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
}

export const templateService = new TemplateService();