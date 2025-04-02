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
    // Ensure prompts is correctly formatted as JSONB for Postgres
    let jsonPrompts;
    try {
      // If prompts is already a string, ensure it's valid JSON
      if (typeof prompts === 'string') {
        try {
          // Validate the JSON string
          JSON.parse(prompts);
          jsonPrompts = prompts;
        } catch (err) {
          // Not valid JSON, wrap it as an array
          jsonPrompts = JSON.stringify([prompts]);
        }
      } else if (Array.isArray(prompts)) {
        // If it's an array, stringify it
        jsonPrompts = JSON.stringify(prompts);
      } else {
        // Default to empty array
        jsonPrompts = '[]';
      }
    } catch (err) {
      console.error('Error formatting prompts as JSON:', err);
      // Default to empty array
      jsonPrompts = '[]';
    }
    
    // Ensure metadata is valid JSON
    let jsonMetadata;
    try {
      if (typeof metadata === 'string') {
        // Validate the JSON string
        JSON.parse(metadata);
        jsonMetadata = metadata;
      } else {
        // Convert object to JSON string
        jsonMetadata = JSON.stringify(metadata || {});
      }
    } catch (err) {
      console.error('Error formatting metadata as JSON:', err);
      // Default to empty object
      jsonMetadata = '{}';
    }
    
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
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true, $8::jsonb)
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
        jsonPrompts,
        template.logo || null,
        frequency,
        jsonMetadata
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

  async createTemplate(userId, data) {
    return await query(
      `INSERT INTO subscription_templates (
        type,
        name,
        description,
        prompts,
        frequency,
        icon,
        logo,
        metadata,
        is_public,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        name,
        description,
        type,
        prompts,
        frequency,
        created_by as "createdBy",
        created_at as "createdAt",
        icon,
        logo,
        metadata,
        is_public as "isPublic"`,
      [
        data.type,
        data.name,
        data.description,
        data.prompts,
        data.frequency,
        data.icon || null,
        data.logo || null,
        JSON.stringify(data.metadata || {}),
        data.isPublic || false,
        userId
      ]
    );
  }
}

export const templateRepository = new TemplateRepository();