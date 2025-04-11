import { z } from 'zod';
import { emailSchema, uuidSchema, timestampSchema } from '../common/base.schema.js';

/**
 * Schema for validating email preference updates
 */
export const emailPreferencesSchema = z.object({
  email_notifications: z.boolean().optional().default(false)
    .describe('Whether the user wants to receive email notifications'),
  notification_email: z.string().email().optional().nullable()
    .describe('Email address to send notifications to (can be different from account email)'),
  digest_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional().default('08:00:00')
    .describe('Time of day to receive daily notification digests (HH:MM:SS format)')
});

/**
 * Schema for validating a test email request
 */
export const testEmailSchema = z.object({
  email: emailSchema
    .describe('Email address to send the test email to')
});

/**
 * Schema for validating setting email_sent status for notifications
 */
export const markEmailSentSchema = z.object({
  notification_ids: z.array(uuidSchema)
    .describe('Array of notification IDs to mark as sent via email'),
  sent_at: timestampSchema.optional().default(() => new Date().toISOString())
    .describe('Timestamp when notifications were sent (defaults to current time)')
}); 