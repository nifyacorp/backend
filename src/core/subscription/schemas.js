/**
 * Subscription validation schemas
 * This file defines the validation schemas for subscription-related operations
 */

import { z } from 'zod';

// Common subscription fields
const subscriptionBase = {
  name: z.string().min(1, { message: 'Name is required' }).max(100),
  description: z.string().max(500).optional(),
  prompts: z.array(z.string().min(1).max(100)).min(1, { message: 'At least one prompt is required' }),
  frequency: z.enum(['immediate', 'daily']),
  active: z.boolean().optional().default(true),
};

// Create subscription schema
export const createSubscriptionSchema = z.object({
  ...subscriptionBase,
  typeId: z.string().min(1, { message: 'Subscription type is required' }),
});

// Update subscription schema
export const updateSubscriptionSchema = z.object({
  ...subscriptionBase,
  typeId: z.string().min(1, { message: 'Subscription type is required' }).optional(),
}).partial();

// Toggle subscription active status schema
export const toggleSubscriptionSchema = z.object({
  active: z.boolean(),
});

// Validate subscription ID parameter
export const idParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid subscription ID format' }),
});

// Subscription query parameters schema
export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  active: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  search: z.string().optional(),
  sort: z.enum(['name', 'created', 'updated']).default('created'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Subscription creation from template
export const fromTemplateSchema = z.object({
  templateId: z.string().min(1, { message: 'Template ID is required' }),
  name: z.string().min(1, { message: 'Name is required' }).max(100).optional(),
});

// Export validation schemas
export default {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  toggleSubscriptionSchema,
  idParamSchema,
  subscriptionQuerySchema,
  fromTemplateSchema,
}; 