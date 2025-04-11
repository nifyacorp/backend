import { z } from 'zod';
import { uuidSchema, timestampSchema } from '../common/base.schema.js';

/**
 * Schema for individual notification items in responses
 */
export const notificationItemSchema = z.object({
  id: z.string()
    .describe('Notification ID'),
  title: z.string()
    .describe('Notification title'),
  content: z.string()
    .describe('Notification content/message body'),
  read: z.boolean()
    .describe('Whether the notification has been read'),
  createdAt: timestampSchema
    .describe('When the notification was created'),
  readAt: timestampSchema.nullable().optional()
    .describe('When the notification was read, if applicable'),
  subscription_name: z.string().optional()
    .describe('Name of the associated subscription, if any'),
  entity_type: z.string().optional()
    .describe('Type of entity this notification is about'),
  metadata: z.record(z.any()).optional()
    .describe('Additional notification metadata')
});

/**
 * Schema for notification list responses
 */
export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationItemSchema)
    .describe('Array of notification items'),
  total: z.number().int().nonnegative()
    .describe('Total number of notifications matching the query'),
  unread: z.number().int().nonnegative()
    .describe('Number of unread notifications'),
  page: z.number().int().positive()
    .describe('Current page number'),
  limit: z.number().int().positive()
    .describe('Number of items per page'),
  hasMore: z.boolean().optional()
    .describe('Whether there are more pages after this one')
});

/**
 * Schema for realtime notification delivery
 */
export const realtimeNotificationSchema = z.object({
  userId: uuidSchema
    .describe('ID of the user to deliver the notification to'),
  notificationId: uuidSchema
    .describe('ID of the notification in the database'),
  notification: z.object({
    id: z.string()
      .describe('Notification ID'),
    title: z.string()
      .describe('Notification title'),
    content: z.string()
      .describe('Notification content'),
    sourceUrl: z.string().url().optional()
      .describe('URL to the source content'),
    entity_type: z.string()
      .describe('Type of entity this notification is about'),
    subscription_id: uuidSchema.optional()
      .describe('ID of the associated subscription'),
    created_at: timestampSchema
      .describe('When the notification was created')
  })
}); 