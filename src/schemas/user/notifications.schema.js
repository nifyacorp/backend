import { z } from 'zod';

/**
 * Schema for updating notification settings
 */
export const updateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional()
    .describe('Whether the user wants to receive email notifications'),
  notificationEmail: z.string().email().nullable().optional()
    .describe('Email address to send notifications to (can be different from account email)'),
  emailFrequency: z.enum(['daily']).optional()
    .describe('Frequency of email notifications'),
  instantNotifications: z.boolean().optional()
    .describe('Whether to send instant notifications')
});

/**
 * Schema for notification settings response
 */
export const notificationSettingsResponseSchema = z.object({
  emailNotifications: z.boolean()
    .describe('Whether the user wants to receive email notifications'),
  notificationEmail: z.string().email().nullable()
    .describe('Email address to send notifications to'),
  emailFrequency: z.enum(['daily'])
    .describe('Frequency of email notifications'),
  instantNotifications: z.boolean()
    .describe('Whether to send instant notifications')
}); 