import { query } from '../../../infrastructure/database/client.js';
import { logRequest } from '../../../shared/logging/logger.js';

export class TemplateRepository {
  async countPublicTemplates() {
    const result = await query(
      `SELECT COUNT(*) 
       FROM subscription_templates t 
       WHERE t.is_public = true`,
      []
    );
    return parseInt(result.rows[0].count);
  }

  async getPublicTemplates(limit, offset) {
    return await query(
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
  }

  async getTemplateById(templateId) {
    return await query(
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
  }

  async getSubscriptionTypeId(typeName) {
    return await query(
      `SELECT id FROM subscription_types WHERE name = $1 AND is_system = true`,
      [typeName.toUpperCase()]
    );
  }

  async createSubscription(userId, typeId, template, prompts, frequency, metadata) {
    return await query(
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
        JSON.stringify(metadata || {})
      ]
    );
  }

  async createProcessingRecord(subscriptionId, frequency, metadata) {
    const nextRunAt = frequency === 'immediate' 
      ? new Date() 
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    return await query(
      `INSERT INTO subscription_processing (
        subscription_id,
        status,
        next_run_at,
        metadata
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [
        subscriptionId,
        'pending',
        nextRunAt,
        JSON.stringify(metadata)
      ]
    );
  }
}

export const templateRepository = new TemplateRepository();