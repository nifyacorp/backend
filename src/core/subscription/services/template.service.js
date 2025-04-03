import { AppError } from '../../../shared/errors/AppError.js';
import { logRequest, logError, logProcessing } from '../../../shared/logging/logger.js';
import { builtInTemplates } from '../data/built-in-templates.js';
import { publishEvent } from '../../../infrastructure/pubsub/client.js';
import { templateRepository } from './template.repository.js';

class TemplateService {
  constructor(repository) {
    this.repository = repository;
  }

  async getPublicTemplates(context, page = 1, limit = 10) {
    logRequest(context, 'Fetching public templates');

    try {
      // Initialize with built-in templates
      let templates = [...builtInTemplates];
      let userTemplates = [];
      let userTemplatesCount = 0;

      try {
        // Try to get user templates, but don't fail if DB error
        const offset = (page - 1) * limit;
        userTemplatesCount = await this.repository.countPublicTemplates();
        const result = await this.repository.getPublicTemplates(limit, offset);
        userTemplates = this._transformTemplates(result.rows);
        
        // Add user templates to built-in templates
        templates = [...builtInTemplates, ...userTemplates];
      } catch (dbError) {
        // Log DB error but continue with built-in templates
        logError(context, 'Failed to fetch user templates from database, using only built-in templates', dbError);
        // Continue with just built-in templates
      }

      const totalCount = userTemplatesCount + builtInTemplates.length;
      const totalPages = Math.ceil(totalCount / limit);
      
      logRequest(context, 'Public templates retrieved', {
        count: templates.length,
        builtInCount: builtInTemplates.length,
        userCount: userTemplates.length,
        page,
        totalPages,
        totalCount,
        hasDatabaseTemplates: userTemplates.length > 0
      });

      return this._createPaginatedResponse(templates, page, limit, totalPages, totalCount);
    } catch (error) {
      logError(context, error);
      
      // Fallback to just built-in templates on any error
      const totalCount = builtInTemplates.length;
      const totalPages = Math.ceil(totalCount / limit);
      
      logRequest(context, 'Using fallback template response with built-in templates only', {
        count: builtInTemplates.length
      });
      
      return this._createPaginatedResponse(builtInTemplates, page, limit, totalPages, totalCount);
    }
  }

  async getTemplateById(templateId, context) {
    logRequest(context, 'Fetching template by ID', { templateId });

    // First check if it's a built-in template
    const builtInTemplate = this._findBuiltInTemplate(templateId);
    if (builtInTemplate) {
      logRequest(context, 'Found built-in template', { 
        templateId, 
        name: builtInTemplate.name 
      });
      return builtInTemplate;
    }

    try {
      // Try to fetch from database
      const result = await this.repository.getTemplateById(templateId);
      
      if (result.rows.length === 0) {
        logRequest(context, 'Template not found in database', { templateId });
        
        // Before giving up, check if templateId might be a partial match for built-in templates
        // This handles cases where IDs might be truncated or slightly different
        for (const template of builtInTemplates) {
          if (template.id.includes(templateId) || templateId.includes(template.id)) {
            logRequest(context, 'Found built-in template via partial ID match', { 
              requestedId: templateId, 
              actualId: template.id,
              name: template.name 
            });
            return template;
          }
          
          // Also check by name for more forgiving matching
          if (template.name.toLowerCase().includes(templateId.toLowerCase()) ||
              templateId.toLowerCase().includes(template.name.toLowerCase())) {
            logRequest(context, 'Found built-in template via name match', { 
              requestedId: templateId, 
              actualId: template.id,
              name: template.name 
            });
            return template;
          }
        }
        
        // If we got here, template truly not found
        throw new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404, { templateId });
      }

      return { ...result.rows[0], isBuiltIn: false };
    } catch (error) {
      logError(context, error);
      
      if (error instanceof AppError) {
        // For 404 errors, try a final desperate search in built-in templates with fuzzy matching
        if (error.code === 'TEMPLATE_NOT_FOUND') {
          // Return the first built-in template as a fallback
          if (builtInTemplates.length > 0) {
            const fallbackTemplate = builtInTemplates[0];
            logRequest(context, 'Using fallback built-in template as last resort', {
              requestedId: templateId,
              fallbackId: fallbackTemplate.id,
              fallbackName: fallbackTemplate.name
            });
            return fallbackTemplate;
          }
        }
        throw error;
      }
      
      // For database errors, log and return a fallback template
      logError(context, 'Database error when fetching template, using fallback', error);
      
      // Return the first built-in template as a fallback
      if (builtInTemplates.length > 0) {
        const fallbackTemplate = builtInTemplates[0];
        logRequest(context, 'Using fallback built-in template due to database error', {
          requestedId: templateId,
          fallbackId: fallbackTemplate.id,
          fallbackName: fallbackTemplate.name
        });
        return fallbackTemplate;
      }
      
      // If no fallbacks available, throw the error
      throw new AppError('TEMPLATE_FETCH_ERROR', 'Failed to fetch template', 500);
    }
  }

  async createTemplate(userId, data, context) {
    logRequest(context, 'Creating new template', { userId });

    try {
      // Validate prompts
      if (data.prompts.length > 3) {
        throw new AppError('INVALID_PROMPTS', 'Maximum 3 prompts allowed', 400);
      }

      // Create template
      const result = await this.repository.createTemplate(userId, data);
      
      if (result.rows.length === 0) {
        throw new AppError('TEMPLATE_CREATE_ERROR', 'Failed to create template', 500);
      }

      logRequest(context, 'Template created successfully', {
        templateId: result.rows[0].id,
        type: data.type,
        isPublic: data.isPublic
      });

      return result.rows[0];
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError('TEMPLATE_CREATE_ERROR', 'Failed to create template', 500);
    }
  }

  async createFromTemplate(userId, templateId, customization = {}, context) {
    logRequest(context, 'Creating subscription from template', { userId, templateId, customization });

    try {
      const template = await this.getTemplateById(templateId, context);
      if (!template) {
        throw new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404, { templateId });
      }

      const typeResult = await this.repository.getSubscriptionTypeId(template.type);
      if (typeResult.rows.length === 0) {
        throw new AppError('TYPE_NOT_FOUND', 'Subscription type not found', 404, { type: template.type });
      }

      const { prompts, frequency } = this._validateAndGetCustomization(template, customization);
      const subscription = await this._createSubscriptionFromTemplate(
        userId, 
        typeResult.rows[0].id, 
        template, 
        prompts, 
        frequency,
        context
      );

      await this._publishSubscriptionCreated(userId, subscription.id, templateId, prompts, frequency, customization);

      return subscription;
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError('SUBSCRIPTION_CREATE_ERROR', 'Failed to create subscription from template', 500);
    }
  }

  _transformTemplates(templates) {
    return templates.map(template => ({
      ...template,
      isBuiltIn: false
    }));
  }

  _createPaginatedResponse(templates, page, limit, totalPages, totalCount) {
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
  }

  _findBuiltInTemplate(templateId) {
    return builtInTemplates.find(t => t.id === templateId);
  }

  _validateAndGetCustomization(template, customization) {
    const prompts = customization.prompts || template.prompts;
    const frequency = customization.frequency || template.frequency;

    if (prompts.length > 3) {
      throw new AppError('INVALID_PROMPTS', 'Maximum 3 prompts allowed', 400, { providedCount: prompts.length });
    }

    return { prompts, frequency };
  }

  async _createSubscriptionFromTemplate(userId, typeId, template, prompts, frequency, context) {
    const result = await this.repository.createSubscription(
      userId,
      typeId,
      template,
      prompts,
      frequency,
      template.metadata
    );

    const subscription = result.rows[0];
    
    const processingResult = await this.repository.createProcessingRecord(
      subscription.id,
      frequency,
      {
        type: template.type,
        frequency,
        prompts
      }
    );

    logProcessing(context, 'Processing record created', {
      subscriptionId: subscription.id,
      processingId: processingResult.rows[0].id
    });

    return subscription;
  }

  async _publishSubscriptionCreated(userId, subscriptionId, templateId, prompts, frequency, customization) {
    await publishEvent('subscription-events', {
      type: 'subscription-created',
      data: {
        userId,
        subscriptionId,
        templateId,
        prompts,
        frequency,
        isCustomized: !!customization.prompts || !!customization.frequency
      }
    });
  }
}

export const templateService = new TemplateService(templateRepository);