import { z } from 'zod';
import { uuidSchema, booleanStringSchema } from '../common/base.schema.js';

/**
 * Notification entity type enumeration
 */
export const notificationEntityTypeSchema = z.enum([
  'boe',
  'doga',
  'subscription',
  'user',
  'system'
]);

/**
 * Notification ID parameter schema
 */
export const notificationIdParamSchema = z.object({
  notificationId: uuidSchema
});

/**
 * Mark notification as read schema
 */
export const markNotificationReadSchema = notificationIdParamSchema; 