/**
 * User schemas index
 * Centralizes exports from all user schema files
 */

import { z } from 'zod';

export * from './base.schema.js';
export * from './profile.schema.js';
export * from './notifications.schema.js';
export * from './email-preferences.schema.js';

// Schema for email preferences
export const emailPreferencesSchema = z.object({
  email_notifications: z.boolean(),
  notification_email: z.string().email().nullable(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
});

// Schema for sending a test email
export const testEmailSchema = z.object({
  email: z.string().email(),
});

// Schema for updating base profile fields and nested metadata
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(), // Maps to display_name
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  avatar: z.string().url().nullable().optional(), // Maps to avatar_url
  bio: z.string().max(500).optional(), // Stored in metadata.profile.bio
  theme: z.enum(['light', 'dark', 'system']).optional(), // metadata.preferences.theme
  language: z.enum(['es', 'en', 'ca']).optional(), // metadata.preferences.language
  notification_settings: z.object({
    emailNotifications: z.boolean().optional(), // metadata.notifications.email.enabled
    notificationEmail: z.string().email().nullable().optional(), // metadata.notifications.email.customEmail
    useCustomEmail: z.boolean().optional(), // metadata.notifications.email.useCustomEmail
    emailFrequency: z.enum(['daily']).optional(), // Legacy, might control digestTime? Adjust as needed.
    instantNotifications: z.boolean().optional(), // Legacy, might control something else? Adjust as needed.
    digestTime: z.string().regex(/^\d{2}:\d{2}$/).optional() // metadata.notifications.email.digestTime
  }).optional()
}).passthrough(); // Use passthrough() instead of strict() to allow additional properties

updateProfileSchema.$id = 'updateProfileSchema'; // Add ID for Fastify schema registration

// Schema for updating just notification settings (kept for reference, but removed from routes)
/*
export const updateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  notificationEmail: z.string().email().nullable().optional(),
  emailFrequency: z.enum(['daily']).optional(),
  instantNotifications: z.boolean().optional()
}).deepPartial();
*/ 