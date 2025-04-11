import { z } from 'zod';
import { uuidSchema, booleanStringSchema, paginationSchema } from '../common/base.schema.js';
import { notificationEntityTypeSchema } from './base.schema.js';

/**
 * Query parameters schema for fetching notifications
 */
export const notificationQuerySchema = paginationSchema.extend({
  unread: booleanStringSchema.optional().default(false)
    .describe('Filter to only unread notifications'),
  subscriptionId: uuidSchema.optional().nullable()
    .describe('Filter by subscription ID'),
  entityType: z.union([notificationEntityTypeSchema, z.string()]).optional()
    .describe('Filter by entity type'),
  // For backward compatibility
  entity_type: z.union([notificationEntityTypeSchema, z.string()]).optional()
    .describe('Filter by entity type (deprecated, use entityType)')
});

/**
 * Activity query schema for notification statistics
 */
export const activityQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional().default(7)
    .describe('Number of days to include in the activity statistics (max 90)')
}); 