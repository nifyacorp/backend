import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format'
});

const emailSchema = z.string().email({
  message: 'Invalid email address format'
});

// User profile schemas
export const updateProfileSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }).max(100).optional(),
  bio: z.string().max(500).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['es', 'en', 'ca']).optional()
});

// Notification settings schemas
export const updateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  notificationEmail: z.string().email().nullable().optional(),
  emailFrequency: z.enum(['daily']).optional(),
  instantNotifications: z.boolean().optional()
});

// User ID param schema
export const userIdParamSchema = z.object({
  userId: uuidSchema
});

// Response schemas
export const userProfileResponseSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  name: z.string(),
  avatar: z.string().nullable(),
  bio: z.string().nullable(),
  theme: z.enum(['light', 'dark', 'system']),
  language: z.enum(['es', 'en', 'ca']),
  notification_settings: z.object({
    emailNotifications: z.boolean(),
    notificationEmail: z.string().email().nullable(),
    emailFrequency: z.enum(['daily']),
    instantNotifications: z.boolean()
  }),
  lastLogin: z.string().datetime(),
  emailVerified: z.boolean(),
  subscriptionCount: z.number().int().nonnegative(),
  notificationCount: z.number().int().nonnegative(),
  lastNotification: z.string().datetime().nullable()
});