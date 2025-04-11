import { z } from 'zod';
import { 
  userThemeSchema, 
  userLanguageSchema, 
  basicUserSchema 
} from './base.schema.js';
import { timestampSchema } from '../common/base.schema.js';

/**
 * Schema for updating a user profile
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }).max(100).optional(),
  bio: z.string().max(500).optional(),
  theme: userThemeSchema.optional(),
  language: userLanguageSchema.optional()
});

/**
 * Schema for notification settings within a user profile
 */
export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  notificationEmail: z.string().email().nullable(),
  emailFrequency: z.enum(['daily']),
  instantNotifications: z.boolean()
});

/**
 * Complete user profile response schema
 */
export const userProfileResponseSchema = basicUserSchema.extend({
  bio: z.string().nullable(),
  theme: userThemeSchema,
  language: userLanguageSchema,
  notification_settings: notificationSettingsSchema,
  lastLogin: timestampSchema,
  subscriptionCount: z.number().int().nonnegative(),
  notificationCount: z.number().int().nonnegative(),
  lastNotification: timestampSchema.nullable()
}); 