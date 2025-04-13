/**
 * Email preferences schema definitions
 * Used for validating email preference related requests
 */

import { z } from 'zod';
import { timeStringSchema } from '../common/base.schema.js';

/**
 * Schema for email preferences update requests
 */
export const emailPreferencesSchema = z.object({
  email_notifications: z.boolean().optional()
    .describe('Whether the user wants to receive email notifications'),
  
  notification_email: z
    .string()
    .email('Please provide a valid email address')
    .nullable()
    .optional()
    .describe('Custom email address for notifications, null means use primary email'),
  
  digest_time: timeStringSchema.optional()
    .describe('Time of day for daily digest emails (format: HH:MM)')
}).strict();

// Add $id property for Fastify schema registration
emailPreferencesSchema.$id = 'emailPreferencesSchema';

/**
 * Schema for test email requests
 */
export const testEmailSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .optional()
    .describe('Optional email address to override user settings for the test')
}).strict();

// Add $id property for Fastify schema registration
testEmailSchema.$id = 'testEmailSchema'; 