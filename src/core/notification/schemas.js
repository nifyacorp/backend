import { z } from 'zod';

// Base schemas for reusable validation
const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format'
});

// Query parameters schema
export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  unread: z.union([
    z.literal('true').transform(() => true),
    z.literal('false').transform(() => false),
    z.boolean()
  ]).optional().default(false),
  subscriptionId: z.string().uuid().optional().nullable()
});

// Notification ID param schema
export const notificationIdParamSchema = z.object({
  notificationId: uuidSchema
});

// Mark notification as read schema
export const markNotificationReadSchema = notificationIdParamSchema;

// Activity query schema
export const activityQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional().default(7)
});

// Realtime notification schema
export const realtimeNotificationSchema = z.object({
  userId: uuidSchema,
  notificationId: uuidSchema,
  notification: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    sourceUrl: z.string().url().optional(),
    entity_type: z.string(),
    subscription_id: z.string().uuid().optional(),
    created_at: z.string().datetime()
  })
});

// Response type for notifications list
export const notificationListResponseSchema = z.object({
  notifications: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    read: z.boolean(),
    createdAt: z.string().datetime(),
    readAt: z.string().datetime().nullable().optional(),
    subscription_name: z.string().optional(),
    entity_type: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })),
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  hasMore: z.boolean().optional()
});