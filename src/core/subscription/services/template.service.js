import { query } from '../../../infrastructure/database/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError } from '../../../shared/logging/logger.js';
import { builtInTemplates } from '../data/built-in-templates.js';

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
          t.default_prompts as prompts,
          t.default_settings->>'frequency' as frequency,
          t.created_by as "createdBy",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
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
          t.default_prompts as prompts,
          t.default_settings->>'frequency' as frequency,
          t.created_by as "createdBy",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
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
}

export const templateService = new TemplateService();