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
      const offset = (page - 1) * limit;
      const userTemplatesCount = await this.repository.countPublicTemplates();
      const totalCount = userTemplatesCount + builtInTemplates.length;
      const totalPages = Math.ceil(totalCount / limit);

      const result = await this.repository.getPublicTemplates(limit, offset);
      const userTemplates = this._transformTemplates(result.rows);
      const templates = [...builtInTemplates, ...userTemplates];

      logRequest(context, 'Public templates retrieved', {
        count: templates.length,
        builtInCount: builtInTemplates.length,
        userCount: userTemplates.length,
        page,
        totalPages,
        totalCount
      });

      return this._createPaginatedResponse(templates, page, limit, totalPages, totalCount);
    } catch (error) {
      logError(context, error);
      throw new AppError('TEMPLATE_FETCH_ERROR', 'Failed to fetch public templates', 500);
    }
  }

  async getTemplateById(templateId, context) {
    logRequest(context, 'Fetching template by ID', { templateId });

    const builtInTemplate = this._findBuiltInTemplate(templateId);
    if (builtInTemplate) return builtInTemplate;

    try {
      const result = await this.repository.getTemplateById(templateId);
      if (result.rows.length === 0) {
        throw new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404, { templateId });
      }

      return { ...result.rows[0], isBuiltIn: false };
    } catch (error) {
      logError(context, error);
      if (error instanceof AppError) throw error;
      throw new AppError('TEMPLATE_FETCH_ERROR', 'Failed to fetch template', 500);
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